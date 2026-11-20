import 'server-only'
import { createHash } from 'node:crypto'
import { sendMail } from '@/lib/server/mail'
import type { Database } from '@/lib/supabase/types'
import { checked, type Client } from './shared'

type Delivery = Pick<
  Database['public']['Tables']['deliveries']['Insert'],
  'kind' | 'dedupe_key' | 'insight_id' | 'recipient_user_id' | 'recipient_email'
>

export async function sendDelivery(
  db: Client,
  organization_id: string,
  rows: Delivery[],
  message: Parameters<typeof sendMail>[0],
) {
  const deliveries = await checked(
    db
      .from('deliveries')
      .upsert(
        rows.map((row) => ({ ...row, organization_id, status: 'pending' })),
        { onConflict: 'organization_id,dedupe_key' },
      )
      .select('id,attempts'),
  )
  if (!deliveries || deliveries.length !== rows.length)
    throw new Error('No se pudieron preparar todas las entregas')

  // Clave del grupo completo: si un reintento agrupa otras alertas, Resend rechazaría la misma clave con otro contenido (409).
  const idempotencyKey = createHash('sha256')
    .update(
      [organization_id, ...rows.map((row) => row.dedupe_key).sort()].join('\n'),
    )
    .digest('hex')
  const result = await sendMail({ ...message, idempotencyKey })
  if (!result.ok && result.error === 'mail-disabled') return 'disabled'

  const sentAt = new Date().toISOString()
  const groupByAttempts = !result.ok || rows[0]?.kind === 'weekly_report'
  for (const attempts of new Set(
    deliveries.map((row) => (groupByAttempts ? row.attempts : 0)),
  )) {
    await checked(
      db
        .from('deliveries')
        .update(
          result.ok
            ? {
                status: 'sent',
                sent_at: sentAt,
                last_error: null,
                ...(groupByAttempts ? { attempts: attempts + 1 } : {}),
              }
            : {
                status: 'failed',
                attempts: attempts + 1,
                last_error: result.error,
              },
        )
        .eq('organization_id', organization_id)
        .in(
          'id',
          deliveries
            .filter((row) => !groupByAttempts || row.attempts === attempts)
            .map(({ id }) => id),
        ),
    )
  }
  return result.ok ? 'sent' : 'failed'
}
