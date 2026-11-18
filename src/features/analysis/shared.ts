import { z } from '@/lib/zod'

export const tableSearchFields = {
  q: z.string().trim().min(1).max(80).optional(),
  pagina: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(1),
  ),
}
export const escapeIlike = (value: string) => value.replace(/[\\%_]/g, '\\$&')

export function tablePage(count: number, requestedPage: number) {
  const pages = Math.max(1, Math.ceil(count / 50))
  const page = Math.min(requestedPage, pages)
  const start = (page - 1) * 50
  return { pages, page, start, end: start + 49 }
}

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
