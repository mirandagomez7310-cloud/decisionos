import { organizationSchema } from '@/features/organizations/schemas'
import { z } from '@/lib/zod'

export const insightStates = [
  'nuevos',
  'vistos',
  'resueltos',
  'descartados',
] as const
export const insightStatuses = ['new', 'seen', 'done', 'dismissed'] as const
export const insightModules = [
  'todos',
  'sales',
  'profit',
  'inventory',
  'cash',
] as const

export const insightsSearchSchema = z.object({
  estado: z.enum(insightStates).default('nuevos'),
  modulo: z.enum(insightModules).default('todos'),
})
export type InsightsSearch = z.infer<typeof insightsSearchSchema>

export const insightStatusSchema = z.object({
  slug: organizationSchema.shape.slug,
  id: z.uuid(),
  status: z.enum(insightStatuses),
})
