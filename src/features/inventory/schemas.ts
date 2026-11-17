import { z } from '@/lib/zod'
import { tableSearchFields } from '@/features/analysis/shared'

export const inventoryOrders = {
  valor: ['inventory_value', false, 'Mayor valor'],
  dias: ['days_on_hand', false, 'Más días de inventario'],
  sin_venta: ['days_since_sale', false, 'Más días sin venta'],
  nombre: ['name', true, 'Nombre'],
} as const

export const inventorySearchSchema = z.object({
  ...tableSearchFields,
  filtro: z.enum(['todos', 'sin_movimiento']).default('todos'),
  orden: z.enum(['valor', 'dias', 'sin_venta', 'nombre']).default('valor'),
})

export type InventorySearch = z.infer<typeof inventorySearchSchema>
