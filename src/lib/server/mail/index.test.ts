import { env } from '@/env'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { sendMail } from './index'

const message = {
  to: 'owner@example.com',
  subject: 'Alerta\r\nBcc: intruso',
  text: 'Resumen',
  html: '<p>Resumen</p>',
}
const fetchMock = vi.fn()
const driver = env.MAIL_DRIVER

beforeEach(() => {
  env.MAIL_DRIVER = 'mailpit'
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  env.MAIL_DRIVER = driver
  vi.unstubAllGlobals()
})

it('sin driver no hace peticiones', async () => {
  env.MAIL_DRIVER = undefined
  expect(await sendMail(message)).toEqual({ ok: false, error: 'mail-disabled' })
  expect(fetchMock).not.toHaveBeenCalled()
})

it('valida el destinatario antes de enviar', async () => {
  expect(await sendMail({ ...message, to: 'inválido' })).toEqual({
    ok: false,
    error: 'invalid-recipient',
  })
  expect(fetchMock).not.toHaveBeenCalled()
})

it('envía a Mailpit con el asunto en una sola línea', async () => {
  fetchMock.mockResolvedValue({ ok: true })
  expect(await sendMail(message)).toEqual({ ok: true })
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
    new URL('/api/v1/send', env.MAILPIT_URL),
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        From: { Email: 'alertas@decisionos.local', Name: 'DecisionOS' },
        To: [{ Email: message.to }],
        Subject: 'Alerta  Bcc: intruso',
        Text: message.text,
        HTML: message.html,
      }),
    }),
  )
})

it('devuelve los fallos de HTTP y red sin incluir datos del correo', async () => {
  fetchMock
    .mockResolvedValueOnce({ ok: false, status: 500 })
    .mockRejectedValueOnce(new Error('Red caída'))
  expect(await sendMail(message)).toEqual({
    ok: false,
    error: 'mailpit-http-500',
  })
  expect(await sendMail(message)).toEqual({
    ok: false,
    error: 'mailpit-network-error',
  })
})
