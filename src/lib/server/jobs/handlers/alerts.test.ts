import { createHash } from 'node:crypto'
import { sendMail } from '@/lib/server/mail'
import { beforeEach, expect, it, vi } from 'vitest'
import type { Client, Job } from '../shared'
import { handleSendAlerts } from './alerts'

vi.mock('@/lib/server/mail', () => ({ sendMail: vi.fn() }))
const mail = vi.mocked(sendMail)
beforeEach(() => mail.mockReset())

const job = {
  id: 'job',
  organization_id: 'org',
  kind: 'send_alerts',
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

const pending = [
  ['first', 'owner'],
  ['second', 'owner'],
  ['first', 'admin'],
].map(([insight_id, recipient_user_id]) => ({
  insight_id,
  recipient_user_id,
  recipient_email: `${recipient_user_id}@example.com`,
}))

function client(alerts = pending) {
  const result = (data: unknown) => Promise.resolve({ data, error: null })
  const rpc = vi.fn(() => ({
    order: () => ({
      order: () => ({ range: () => result(alerts) }),
    }),
  }))
  const upsert = vi.fn(
    (rows: { dedupe_key: string; insight_id: string }[]) => ({
      select: () =>
        result(
          rows.map(({ dedupe_key, insight_id }) => ({
            id: dedupe_key,
            attempts: insight_id === 'first' ? 1 : 0,
          })),
        ),
    }),
  )
  const filteredIds = vi.fn(() => result(null))
  const update = vi.fn(() => ({ eq: () => ({ in: filteredIds }) }))
  const insert = vi.fn(() => result(null))
  const from = vi.fn(() => ({
    upsert,
    update,
    insert,
    select: () => ({
      eq: () => ({
        single: () => result({ name: 'Empresa', slug: 'empresa' }),
        eq: () => ({
          in: () => ({
            in: () =>
              result(
                ['first', 'second'].map((id) => ({
                  id,
                  title: id,
                  severity: 'critical',
                  body: 'Saldo pendiente',
                })),
              ),
          }),
        }),
      }),
    }),
  }))
  return {
    db: { rpc, from } as unknown as Client,
    rpc,
    from,
    upsert,
    update,
    insert,
    filteredIds,
  }
}

it('agrupa, conserva intentos por insight y sigue tras el fallo del primer destinatario', async () => {
  const { db, rpc, upsert, update, insert, filteredIds } = client()
  mail
    .mockResolvedValueOnce({ ok: false, error: 'mailpit-http-500' })
    .mockResolvedValueOnce({ ok: true })

  await handleSendAlerts(db, job)

  expect(rpc).toHaveBeenCalledExactlyOnceWith('pending_alerts', {
    p_organization_id: 'org',
  })
  expect(mail).toHaveBeenCalledTimes(2)
  expect(mail).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      to: 'owner@example.com',
      idempotencyKey: createHash('sha256')
        .update('org\nalert:first:owner\nalert:second:owner')
        .digest('hex'),
      text: expect.stringMatching(/first[\s\S]+second/),
    }),
  )
  expect(mail).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      to: 'admin@example.com',
      subject: expect.stringContaining('1 alerta nueva'),
    }),
  )
  expect(upsert).toHaveBeenNthCalledWith(
    1,
    [
      expect.objectContaining({
        dedupe_key: 'alert:first:owner',
        status: 'pending',
      }),
      expect.objectContaining({
        dedupe_key: 'alert:second:owner',
        status: 'pending',
      }),
    ],
    { onConflict: 'organization_id,dedupe_key' },
  )
  expect(update).toHaveBeenNthCalledWith(1, {
    status: 'failed',
    attempts: 2,
    last_error: 'mailpit-http-500',
  })
  expect(update).toHaveBeenNthCalledWith(2, {
    status: 'failed',
    attempts: 1,
    last_error: 'mailpit-http-500',
  })
  expect(update).toHaveBeenNthCalledWith(3, {
    status: 'sent',
    sent_at: expect.any(String),
    last_error: null,
  })
  expect(filteredIds.mock.calls).toEqual([
    ['id', ['alert:first:owner']],
    ['id', ['alert:second:owner']],
    ['id', ['alert:first:admin']],
  ])
  expect(insert).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      action: 'alerts.sent',
      data: { recipients: 2, insights: 2, failed: 1 },
    }),
  )
})

it('mantiene pending sin incrementar intentos cuando el correo está desactivado', async () => {
  const { db, upsert, update, insert } = client()
  mail.mockResolvedValue({ ok: false, error: 'mail-disabled' })
  await handleSendAlerts(db, job)
  expect(upsert).toHaveBeenCalledTimes(2)
  expect(update).not.toHaveBeenCalled()
  expect(insert).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      data: { recipients: 2, insights: 2, failed: 0, disabled: 2 },
    }),
  )
})

it('audita una pasada vacía sin consultar la organización ni enviar correo', async () => {
  const { db, from, insert } = client([])
  await handleSendAlerts(db, job)
  expect(from).toHaveBeenCalledExactlyOnceWith('audit_log')
  expect(mail).not.toHaveBeenCalled()
  expect(insert).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      data: { recipients: 0, insights: 0, failed: 0 },
    }),
  )
})
