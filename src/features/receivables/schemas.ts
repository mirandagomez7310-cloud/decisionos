import { z } from '@/lib/zod'
import { tableSearchFields } from '@/features/analysis/shared'

export const riskLevels = ['alto', 'medio', 'bajo'] as const
export const riskLabels = { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' }

export const receivablesOrders = {
  vencido: ['overdue_balance', false, 'Mayor vencido'],
  saldo: ['open_balance', false, 'Mayor saldo'],
  dias: ['max_days_overdue', false, 'Más días de vencimiento'],
  credito: ['credit_used_pct', false, 'Mayor uso de crédito'],
  nombre: ['name', true, 'Nombre'],
} as const

export const receivablesSearchSchema = z.object({
  ...tableSearchFields,
  riesgo: z.enum(['todos', ...riskLevels]).default('todos'),
  orden: z
    .enum(['vencido', 'saldo', 'dias', 'credito', 'nombre'])
    .default('vencido'),
})

export type ReceivablesSearch = z.infer<typeof receivablesSearchSchema>
