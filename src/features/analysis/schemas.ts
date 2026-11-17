import { z } from '@/lib/zod'
import { periodSchema } from '@/lib/server/metrics/period'

const common = {
  periodo: periodSchema,
  vista: z.enum(['productos', 'clientes']).default('productos'),
  q: z.string().trim().min(1).max(80).optional(),
  pagina: z.preprocess(
    (value) => (typeof value === 'string' ? Number(value) : value),
    z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(1),
  ),
}
export const salesOrders = {
  cambio_baja: ['delta', true, 'Mayor caída'],
  cambio_sube: ['delta', false, 'Mayor subida'],
  venta: ['net_sales', false, 'Mayor venta'],
  nombre: ['name', true, 'Nombre'],
} as const
export const marginOrders = {
  margen_pct_asc: ['margin_pct', true, 'Menor margen %'],
  margen_pct_desc: ['margin_pct', false, 'Mayor margen %'],
  margen: ['gross_margin', false, 'Mayor margen'],
  venta: ['net_sales', false, 'Mayor venta'],
  nombre: ['name', true, 'Nombre'],
} as const
export const salesSearchSchema = z.object({
  ...common,
  orden: z
    .enum(['cambio_baja', 'cambio_sube', 'venta', 'nombre'])
    .default('cambio_baja'),
})
export const marginSearchSchema = z.object({
  ...common,
  orden: z
    .enum(['margen_pct_asc', 'margen_pct_desc', 'margen', 'venta', 'nombre'])
    .default('margen_pct_asc'),
})
export type AnalysisSearch =
  z.infer<typeof salesSearchSchema> | z.infer<typeof marginSearchSchema>
export type AnalysisScreen = 'sales' | 'margin'
export const escapeIlike = (value: string) => value.replace(/[\\%_]/g, '\\$&')
