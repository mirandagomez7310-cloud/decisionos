import { sendMail } from '@/lib/server/mail'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Client, Job } from '../shared'
import { handleWeeklyReport } from './weekly-report'

vi.mock('@/lib/server/mail', () => ({ sendMail: vi.fn() }))
const mail = vi.mocked(sendMail)
beforeEach(() => {
  vi.setSystemTime(new Date('2026-01-06T05:59:59Z'))
  mail.mockReset()
})
afterEach(() => vi.useRealTimers())

const job = {
  id: 'job',
  organization_id: 'org',
  kind: 'weekly_report',
  status: 'running',
  payload: {},
  attempts: 1,
  max_attempts: 3,
  created_at: '',
  finished_at: null,
  locked_at: null,
  locked_by: null,
  last_error: null,
  progress: {},
  run_after: '',
} satisfies Job

type Previous = { status: 'sent' | 'failed'; attempts: number }
function client(previous: Record<string, Previous> = {}) {
  const result = (data: unknown) => Promise.resolve({ data, error: null })
  const recipients = ['owner', 'admin'].map((user_id) => ({
    user_id,
    email: `${user_id}@example.com`,
  }))
  const rpc = vi.fn((name: string) =>
    name === 'alert_recipients'
      ? { order: () => ({ range: () => result(recipients) }) }
      : { single: () => result(null) },
  )
  const lookup = vi.fn((_field: string, key: string) => ({
    maybeSingle: () => result(previous[key] ?? null),
  }))
  const upsert = vi.fn((rows: { dedupe_key: string }[]) => ({
    select: () =>
      result(
        rows.map(({ dedupe_key }) => ({
          id: dedupe_key,
          attempts: previous[dedupe_key]?.attempts ?? 0,
        })),
      ),
  }))
  const update = vi.fn(() => ({ eq: () => ({ in: () => result(null) }) }))
  const insert = vi.fn(() => result(null))
  const insights = {
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: () => result([]),
  }
  const from = vi.fn((name: string) => {
    if (name === 'organizations')
      return {
        select: () => ({
          eq: () => ({
            single: () => result({ name: 'Empresa', slug: 'empresa' }),
          }),
        }),
      }
    if (name === 'insights') return { select: () => insights }
    if (name === 'sales' || name === 'receivables') {
      const query = { lte: () => query, limit: () => result([]) }
      return { select: () => ({ eq: () => query }) }
    }
    return {
      select: () => ({ eq: () => ({ eq: lookup }) }),
      upsert,
      update,
      insert,
    }
  })
  return {
    db: { rpc, from } as unknown as Client,
    rpc,
    insights,
    lookup,
    upsert,
    update,
    insert,
  }
}

it('omite entregas enviadas y fallidas con tres intentos y audita la pasada', async () => {
  const { db, lookup, upsert, insert } = client({
    'weekly:2025-12-29:owner': { status: 'sent', attempts: 1 },
    'weekly:2025-12-29:admin': { status: 'failed', attempts: 3 },
  })
  await handleWeeklyReport(db, job)
  expect(lookup.mock.calls).toEqual([
    ['dedupe_key', 'weekly:2025-12-29:owner'],
    ['dedupe_key', 'weekly:2025-12-29:admin'],
  ])
  expect(mail).not.toHaveBeenCalled()
  expect(upsert).not.toHaveBeenCalled()
  expect(insert).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      action: 'reports.sent',
      data: { recipients: 0, sent: 0, failed: 0, disabled: 0 },
    }),
  )
})

it('deja pendientes los envíos desactivados y usa cortes de México', async () => {
  const { db, rpc, insights, upsert, update, insert } = client()
  mail.mockResolvedValue({ ok: false, error: 'mail-disabled' })
  await handleWeeklyReport(db, job)
  expect(rpc).toHaveBeenCalledWith('metrics_summary', {
    p_organization_id: 'org',
    p_from: '2025-12-29',
    p_to: '2026-01-04',
    p_prev_from: '2025-12-22',
    p_prev_to: '2025-12-28',
  })
  for (const name of ['inventory_summary', 'receivables_summary'])
    expect(rpc).toHaveBeenCalledWith(name, {
      p_organization_id: 'org',
      p_as_of: '2026-01-04',
    })
  expect(insights.neq).toHaveBeenCalledWith('status', 'dismissed')
  expect(insights.gte).toHaveBeenCalledWith(
    'created_at',
    '2025-12-29T00:00:00-06:00',
  )
  expect(insights.lt).toHaveBeenCalledWith(
    'created_at',
    '2026-01-05T00:00:00-06:00',
  )
  expect(upsert).toHaveBeenNthCalledWith(
    1,
    [
      expect.objectContaining({
        kind: 'weekly_report',
        insight_id: null,
        status: 'pending',
        dedupe_key: 'weekly:2025-12-29:owner',
        recipient_user_id: 'owner',
      }),
    ],
    { onConflict: 'organization_id,dedupe_key' },
  )
  expect(upsert).toHaveBeenCalledTimes(2)
  expect(update).not.toHaveBeenCalled()
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({
      data: { recipients: 2, sent: 0, failed: 0, disabled: 2 },
    }),
  )
})

it('sigue tras un fallo y registra los intentos y conteos de ambos resultados', async () => {
  const { db, update, insert } = client({
    'weekly:2025-12-29:owner': { status: 'failed', attempts: 2 },
  })
  mail
    .mockResolvedValueOnce({ ok: false, error: 'mailpit-http-500' })
    .mockResolvedValueOnce({ ok: true })
  await handleWeeklyReport(db, job)
  expect(mail).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ to: 'owner@example.com' }),
  )
  expect(mail).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ to: 'admin@example.com' }),
  )
  expect(update).toHaveBeenNthCalledWith(1, {
    status: 'failed',
    attempts: 3,
    last_error: 'mailpit-http-500',
  })
  expect(update).toHaveBeenNthCalledWith(2, {
    status: 'sent',
    attempts: 1,
    sent_at: expect.any(String),
    last_error: null,
  })
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({
      action: 'reports.sent',
      data: { recipients: 2, sent: 1, failed: 1, disabled: 0 },
    }),
  )
})
