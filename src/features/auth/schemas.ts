import { z } from 'zod'
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
    return url.origin === 'https://internal.invalid'
      ? url.pathname + url.search + url.hash
      : '/'
  } catch {
    return '/'
  }
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
