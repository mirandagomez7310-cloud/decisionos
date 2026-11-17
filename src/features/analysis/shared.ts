import { z } from '@/lib/zod'

export const tableSearchFields = {
  q: z.string().trim().min(1).max(80).optional(),
  pagina: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(1),
  ),
}
export const escapeIlike = (value: string) => value.replace(/[\\%_]/g, '\\$&')

export function tableHref<T extends { pagina: number }>(
  path: string,
  search: T,
) {
  return (changes: Partial<Record<keyof T, string>> = {}) => {
    const values = new URLSearchParams()
    for (const [key, value] of Object.entries({
      ...search,
      pagina: '1',
      ...changes,
    })) {
      if (value) values.set(key, String(value))
    }
    return `${path}?${values}`
  }
}
