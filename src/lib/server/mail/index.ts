import 'server-only'
import { env } from '@/env'
import { z } from '@/lib/zod'

type Message = {
  to: string
  subject: string
  text: string
  html: string
  idempotencyKey?: string
}

type Result = { ok: true } | { ok: false; error: string }

export async function sendMail(message: Message): Promise<Result> {
  if (!env.MAIL_DRIVER) return { ok: false, error: 'mail-disabled' }
  if (!z.email().safeParse(message.to).success)
    return { ok: false, error: 'invalid-recipient' }
  return env.MAIL_DRIVER === 'resend'
    ? sendResend(message)
    : sendMailpit(message)
}

async function sendMailpit({
  to,
  subject,
  text,
  html,
}: Message): Promise<Result> {
  const sender = env.MAIL_FROM.match(/^([^<>\r\n]+)\s*<([^<>]+)>$/)
  const fromEmail = sender?.[2] ?? env.MAIL_FROM
  if (!z.email().safeParse(fromEmail).success)
    return { ok: false, error: 'invalid-sender' }

  try {
    const response = await fetch(new URL('/api/v1/send', env.MAILPIT_URL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: { Email: fromEmail, Name: sender?.[1]?.trim() },
        To: [{ Email: to }],
        Subject: subject.replace(/[\r\n]/g, ' '),
        Text: text,
        HTML: html,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    return response.ok
      ? { ok: true }
      : { ok: false, error: `mailpit-http-${response.status}` }
  } catch {
    return { ok: false, error: 'mailpit-network-error' }
  }
}

async function sendResend({
  to,
  subject,
  text,
  html,
  idempotencyKey,
}: Message): Promise<Result> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [to],
        subject: subject.replace(/[\r\n\u2028\u2029]/g, ' '),
        html,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    return response.ok
      ? { ok: true }
      : { ok: false, error: `resend-http-${response.status}` }
  } catch {
    return { ok: false, error: 'resend-network-error' }
  }
}
