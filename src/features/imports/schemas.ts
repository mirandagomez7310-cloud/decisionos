import { z } from '@/lib/zod'

export const kindSchema = z.enum([
  'products',
  'customers',
  'sales',
  'inventory',
  'receivables',
])
export const importSchema = z.object({
  organizationId: z.uuid(),
  importId: z.uuid(),
})
export const uploadSchema = z.object({
  organizationId: z.uuid(),
  kind: kindSchema,
  file: z
    .instanceof(File)
    .refine(
      (file) => file.size > 0 && file.size <= 25 * 1024 * 1024,
      'El archivo debe contener datos y pesar como máximo 25 MiB.',
    )
    .refine(
      (file) => /\.(csv|xlsx)$/i.test(file.name),
      'Usa un archivo CSV o XLSX.',
    ),
})
export const mappingSchema = z.record(z.string(), z.string().nullable())
export const catalogSearchSchema = z.object({
  q: z.string().trim().max(200).default(''),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum(['code', '-code', 'name', '-name', 'created_at', '-created_at'])
    .default('name'),
})
export const sanitizeFilename = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180)

export function catalogFilter(q: string, code: 'sku' | 'code') {
  // Las comillas protegen la sintaxis de PostgREST; las barras escapan comodines de LIKE.
  const pattern = JSON.stringify(`%${q.replace(/[\\%_]/g, '\\$&')}%`)
  return `${code}.ilike.${pattern},name.ilike.${pattern}`
}
