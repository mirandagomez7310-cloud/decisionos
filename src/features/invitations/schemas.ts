import { z } from '@/lib/zod'
import { roleSchema } from '@/features/members/schemas'
export const invitationSchema = z.object({
  organizationId: z.uuid(),
  email: z.email().trim().toLowerCase(),
  role: roleSchema,
})
export const revokeSchema = z.object({
  organizationId: z.uuid(),
  invitationId: z.uuid(),
})
export const tokenSchema = z.string().regex(/^[0-9a-f]{64}$/)
