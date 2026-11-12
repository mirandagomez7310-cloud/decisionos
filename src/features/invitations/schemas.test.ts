import { expect, it } from 'vitest'
import { invitationSchema, revokeSchema, tokenSchema } from './schemas'
it('valida correo, rol e identidades de invitación', () => {
  const input = {
    organizationId: '00000000-0000-4000-8000-000000000001',
    email: 'Persona@example.com',
    role: 'viewer',
  }
  expect(invitationSchema.parse(input).email).toBe('persona@example.com')
  expect(invitationSchema.safeParse({ ...input, email: 'no' }).success).toBe(
    false,
  )
  expect(invitationSchema.safeParse({ ...input, role: 'root' }).success).toBe(
    false,
  )
  expect(
    revokeSchema.safeParse({
      organizationId: input.organizationId,
      invitationId: 'no',
    }).success,
  ).toBe(false)
  expect(tokenSchema.safeParse('a'.repeat(64)).success).toBe(true)
  expect(tokenSchema.safeParse('a'.repeat(63)).success).toBe(false)
})
