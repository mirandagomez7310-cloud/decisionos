import 'server-only'
import { env } from '@/env'
import { z } from '@/lib/zod'

export async function sendMail({
  to,
  subject,
  text,
  html,
}: {
  to: string
  subject: string
  text: string
  html: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!env.MAIL_DRIVER) return { ok: false, error: 'mail-disabled' }
  if (!z.email().safeParse(to).success)
    return { ok: false, error: 'invalid-recipient' }
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
