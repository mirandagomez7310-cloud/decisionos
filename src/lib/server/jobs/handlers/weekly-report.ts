import 'server-only'
import { env } from '@/env'
import { weeklyReportEmail } from '@/lib/server/mail/templates'
import { resolveWeek, todayInMexico } from '@/lib/server/metrics/period'
import type { Database, Insight } from '@/lib/supabase/types'
import { sendDelivery } from '../deliveries'
import { audit, checked, type Client, type Job } from '../shared'

type Recipient =
  Database['public']['Functions']['alert_recipients']['Returns'][number]
type ReportInsight = Pick<Insight, 'severity' | 'title' | 'body' | 'created_at'>

const mexicoOffset = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Mexico_City',
  timeZoneName: 'longOffset',
})
function mexicoMidnight(day: string) {
  const offset = mexicoOffset
    .formatToParts(new Date(day + 'T12:00:00Z'))
    .find(({ type }) => type === 'timeZoneName')!
    .value.slice(3)
  return day + 'T00:00:00' + offset
}

export async function handleWeeklyReport(db: Client, job: Job) {
  const organization_id = job.organization_id
  if (!organization_id) throw new Error('Job sin organización')

  const today = todayInMexico(new Date())
  const { from, to, prevFrom, prevTo } = resolveWeek(today)
  const args = { p_organization_id: organization_id }
  const cut = { ...args, p_as_of: to }
  const counts = { recipients: 0, sent: 0, failed: 0, disabled: 0 }
  const recipients: Recipient[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const page = await checked(
      db
        .rpc('alert_recipients', args)
        .order('user_id')
        .range(offset, offset + pageSize - 1),
    )
    recipients.push(...(page ?? []))
    if (!page || page.length < pageSize) break
  }

  if (recipients.length) {
    const [
      organization,
      sales,
      inventory,
      receivables,
      salesRows,
      receivableRows,
    ] = await Promise.all([
      checked(
        db
          .from('organizations')
          .select('name,slug')
          .eq('id', organization_id)
          .single(),
      ),
      checked(
        db
          .rpc('metrics_summary', {
            ...args,
            p_from: from,
            p_to: to,
            p_prev_from: prevFrom,
            p_prev_to: prevTo,
          })
          .single(),
      ),
      checked(db.rpc('inventory_summary', cut).single()),
      checked(db.rpc('receivables_summary', cut).single()),
      checked(
        db
          .from('sales')
          .select('id')
          .eq('organization_id', organization_id)
          .limit(1),
      ),
      checked(
        db
          .from('receivables')
          .select('id')
          .eq('organization_id', organization_id)
          .lte('issued_on', to)
          .limit(1),
      ),
    ])
    if (!organization) throw new Error('Organización inexistente')

    const insights: ReportInsight[] = []
    for (let offset = 0; ; offset += pageSize) {
      const page = await checked(
        db
          .from('insights')
          .select('severity,title,body,created_at')
          .eq('organization_id', organization_id)
          .neq('status', 'dismissed')
          .gte('created_at', mexicoMidnight(from))
          .lt('created_at', mexicoMidnight(today))
          .order('created_at')
          .order('id')
          .range(offset, offset + pageSize - 1),
      )
      insights.push(...(page ?? []))
      if (!page || page.length < pageSize) break
    }

    const message = weeklyReportEmail({
      organizationName: organization.name,
      slug: organization.slug,
      appUrl: env.APP_URL,
      from,
      to,
      sales: salesRows?.length ? sales : null,
      inventory: inventory?.snapshot_on ? inventory : null,
      receivables: receivableRows?.length ? receivables : null,
      insights,
    })

    for (const { user_id, email } of recipients) {
      const dedupe_key = `weekly:${from}:${user_id}`
      const previous = await checked(
        db
          .from('deliveries')
          .select('status,attempts')
          .eq('organization_id', organization_id)
          .eq('dedupe_key', dedupe_key)
          .maybeSingle(),
      )
      if (
        previous?.status === 'sent' ||
        (previous?.status === 'failed' && previous.attempts >= 3)
      )
        continue

      const outcome = await sendDelivery(
        db,
        organization_id,
        [
          {
            kind: 'weekly_report',
            dedupe_key,
            insight_id: null,
            recipient_user_id: user_id,
            recipient_email: email,
          },
        ],
        { to: email, ...message },
      )
      counts.recipients++
      counts[outcome]++
    }
  }

  await audit(db, job, 'reports.sent', {
    entity: 'deliveries',
    entityId: job.id,
    data: counts,
  })
}
