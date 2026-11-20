import { z } from '@/lib/zod'
export function sanitizeNext(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\s%]/.test(value) ||
    Array.from(value).some((character) => character.charCodeAt(0) < 32)
  )
    return '/'
  try {
    const url = new URL(value, 'https://internal.invalid')
    if (url.origin !== 'https://internal.invalid') return '/'
    // '/..//x' se normaliza a '//x': protocolo relativo, redirección abierta.
    return '/' + url.pathname.replace(/^\/+/, '') + url.search + url.hash
  } catch {
    return '/'
  }
}
export function confirmRedirect(next: string | null, appUrl: string): string {
  if (!next) return '/'
  if (next.startsWith('/')) return sanitizeNext(next)
  try {
    const url = new URL(next)
    if (url.origin === new URL(appUrl).origin)
      return sanitizeNext(url.pathname + url.search)
  } catch {
    return '/'
  }
  return '/'
}

export const authSchema = z.object({
  email: z.email('Introduce un correo válido.').max(254),
  password: z
    .string()
    .min(8, 'Usa al menos 8 caracteres.')
    .max(128, 'Usa como máximo 128 caracteres.'),
  next: z.string().transform(sanitizeNext),
})
export type AuthInput = z.input<typeof authSchema>
