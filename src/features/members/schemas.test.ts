import { describe, expect, it } from 'vitest'
import { memberSchema, memberRoleSchema, membersSearchSchema } from './schemas'
const id = '00000000-0000-4000-8000-000000000001'
describe('esquemas de miembros', () => {
  it('valida identidades y roles', () => {
    expect(
      memberSchema.safeParse({ organizationId: id, userId: id }).success,
    ).toBe(true)
    expect(
      memberSchema.safeParse({ organizationId: 'otro', userId: id }).success,
    ).toBe(false)
    expect(
      memberRoleSchema.safeParse({
        organizationId: id,
        userId: id,
        role: 'owner',
      }).success,
    ).toBe(true)
    expect(
      memberRoleSchema.safeParse({
        organizationId: id,
        userId: id,
        role: 'root',
      }).success,
    ).toBe(false)
  })
  it('limita paginación y orden de URL', () => {
    expect(membersSearchSchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      sort: 'created_at',
    })
    expect(
      membersSearchSchema.parse({ page: '2', pageSize: '100', sort: '-email' })
        .page,
    ).toBe(2)
    for (const input of [
      { page: '0' },
      { page: '1.5' },
      { pageSize: '101' },
      { pageSize: '0' },
      { sort: 'token_hash' },
      { page: ['1', '2'] },
    ])
      expect(membersSearchSchema.safeParse(input).success).toBe(false)
  })
})
