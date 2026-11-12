import { z } from '@/lib/zod'

export const roleSchema = z.enum(['owner', 'admin', 'analyst', 'viewer'])
export const memberSchema = z.object({
  organizationId: z.uuid(),
  userId: z.uuid(),
})
export const memberRoleSchema = memberSchema.extend({ role: roleSchema })
export const membersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum(['email', 'role', 'created_at', '-email', '-role', '-created_at'])
    .default('created_at'),
})
