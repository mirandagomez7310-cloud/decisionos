import { z } from '@/lib/zod'
import { tableSearchFields } from './shared'
import { periodSchema } from '@/lib/server/metrics/period'

const common = {
  periodo: periodSchema,
  vista: z.enum(['productos', 'clientes']).default('productos'),
  ...tableSearchFields,
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
