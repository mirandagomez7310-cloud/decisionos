import 'server-only'
import { env } from '@/env'
import { sendMail } from '@/lib/server/mail'
import { alertEmail } from '@/lib/server/mail/templates'
import type { Database, Insight } from '@/lib/supabase/types'
import { audit, batches, checked, type Client, type Job } from '../shared'

type PendingAlert =
  Database['public']['Functions']['pending_alerts']['Returns'][number]

export async function handleSendAlerts(db: Client, job: Job) {
  const organization_id = job.organization_id
  if (!organization_id) throw new Error('Job sin organización')

  const groups = new Map<string, PendingAlert[]>()
  const insightIds = new Set<string>()
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const page = await checked(
      db
        .rpc('pending_alerts', { p_organization_id: organization_id })
        .order('recipient_user_id')
        .order('insight_id')
        .range(offset, offset + pageSize - 1),
    )
    for (const alert of page ?? []) {
      insightIds.add(alert.insight_id)
      const group = groups.get(alert.recipient_user_id)
      if (group) group.push(alert)
      else groups.set(alert.recipient_user_id, [alert])
    }
    if (!page || page.length < pageSize) break
  }

  const counts = { recipients: 0, insights: 0, failed: 0 }
  let disabled = 0
  if (groups.size) {
    const organization = await checked(
      db
        .from('organizations')
        .select('name,slug')
        .eq('id', organization_id)
        .single(),
    )
    if (!organization) throw new Error('Organización inexistente')
    const insights = new Map<
      string,
      Pick<Insight, 'id' | 'severity' | 'title' | 'body'>
    >()
    for (const ids of batches([...insightIds], 100)) {
      const rows = await checked(
        db
          .from('insights')
          .select('id,severity,title,body')
          .eq('organization_id', organization_id)
          .eq('status', 'new')
          .in('severity', ['warning', 'critical'])
          .in('id', ids),
      )
      for (const row of rows ?? []) insights.set(row.id, row)
    }

    const included = new Set<string>()
    for (const [recipient_user_id, alerts] of groups) {
      const items = alerts.flatMap(({ insight_id }) => {
        const insight = insights.get(insight_id)
        return insight ? [insight] : []
      })
      if (!items.length) continue
      const recipient_email = alerts[0]!.recipient_email
      const deliveries = await checked(
        db
          .from('deliveries')
          .upsert(
            items.map(({ id }) => ({
              organization_id,
              kind: 'alert',
              dedupe_key: `alert:${id}:${recipient_user_id}`,
              insight_id: id,
              recipient_user_id,
              recipient_email,
              status: 'pending',
            })),
            { onConflict: 'organization_id,dedupe_key' },
          )
          .select('id,attempts'),
      )
      if (deliveries?.length !== items.length)
        throw new Error('No se pudieron preparar todas las entregas')

      counts.recipients++
      for (const { id } of items) included.add(id)
      const result = await sendMail({
        to: recipient_email,
        ...alertEmail({
          organizationName: organization.name,
          appUrl: env.APP_URL,
          slug: organization.slug,
          insights: items,
        }),
      })
      if (result.ok) {
        const sent_at = new Date().toISOString()
        await checked(
          db
            .from('deliveries')
            .update({ status: 'sent', sent_at, last_error: null })
            .eq('organization_id', organization_id)
            .in(
              'id',
              deliveries.map(({ id }) => id),
            ),
        )
      } else if (result.error === 'mail-disabled') {
        disabled++
      } else {
        counts.failed++
        for (const attempts of new Set(deliveries.map((row) => row.attempts))) {
          await checked(
            db
              .from('deliveries')
              .update({
                status: 'failed',
                attempts: attempts + 1,
                last_error: result.error,
              })
              .eq('organization_id', organization_id)
              .in(
                'id',
                deliveries
                  .filter((row) => row.attempts === attempts)
                  .map(({ id }) => id),
              ),
          )
        }
      }
    }
    counts.insights = included.size
  }

  await audit(db, job, 'alerts.sent', {
    entity: 'deliveries',
    entityId: job.id,
    data: disabled ? { ...counts, disabled } : counts,
  })
}
