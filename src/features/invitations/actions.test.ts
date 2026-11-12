// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), client: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({
  requireRoleForAction: mocks.auth,
  getUser: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }))
vi.mock('next/cache', () => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
import { createInvitation, revokeInvitation, acceptInvitation } from './actions'
const id = '00000000-0000-4000-8000-000000000001'
beforeEach(() => {
  vi.resetAllMocks()
})
it('rechaza owner para admin antes de acceder a datos', async () => {
  mocks.auth.mockResolvedValue({
    ok: true,
    data: { role: 'admin', user: { id } },
  })
  expect(
    await createInvitation({
      organizationId: id,
      email: 'test@example.com',
      role: 'owner',
    }),
  ).toEqual({ error: 'No tienes permiso para esta acción' })
  expect(mocks.client).not.toHaveBeenCalled()
})
it('sesión caducada devuelve datos en crear y revocar', async () => {
  mocks.auth.mockResolvedValue({ ok: false, error: 'unauthenticated' })
  expect(
    await createInvitation({
      organizationId: id,
      email: 'test@example.com',
      role: 'viewer',
    }),
  ).toEqual({ error: expect.stringContaining('Tu sesión caducó') })
  expect(
    await revokeInvitation({ organizationId: id, invitationId: id }),
  ).toEqual({ error: expect.stringContaining('Tu sesión caducó') })
  expect(mocks.client).not.toHaveBeenCalled()
})
it('token inválido no consulta datos ni distingue causa', async () => {
  expect(await acceptInvitation('invalid')).toEqual({
    error: 'Invitación inválida, caducada o para otro correo',
  })
  expect(mocks.client).not.toHaveBeenCalled()
})
it('guarda solo el hash y el actor real, y devuelve el enlace una vez', async () => {
  mocks.auth.mockResolvedValue({
    ok: true,
    data: { role: 'owner', user: { id } },
  })
  const insertInvitation = vi.fn((_input: unknown) => ({
    select: () => ({ single: async () => ({ data: { id }, error: null }) }),
  }))
  const insertAudit = vi.fn().mockResolvedValue({ error: null })
  mocks.client.mockResolvedValue({
    from: (table: string) => ({
      insert: table === 'invitations' ? insertInvitation : insertAudit,
    }),
  })
  const result = await createInvitation({
    organizationId: id,
    email: 'test@example.com',
    role: 'viewer',
  })
  expect(result).toEqual({
    invitationId: id,
    url: expect.stringMatching(/^\/invitations\/[a-f0-9]{64}$/),
  })
  const saved = insertInvitation.mock.calls[0]?.[0]
  expect(saved).toEqual({
    organization_id: id,
    email: 'test@example.com',
    role: 'viewer',
    token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    created_by: id,
  })
  expect(insertAudit).toHaveBeenCalledWith(
    expect.objectContaining({
      actor_user_id: id,
      actor_kind: 'user',
      action: 'invitations.created',
    }),
  )
})
it('devuelve correo duplicado como fieldErrors.email', async () => {
  mocks.auth.mockResolvedValue({
    ok: true,
    data: { role: 'owner', user: { id } },
  })
  mocks.client.mockResolvedValue({
    from: () => ({
      insert: () => ({
        select: () => ({
          single: async () => ({ data: null, error: { code: '23505' } }),
        }),
      }),
    }),
  })
  expect(
    await createInvitation({
      organizationId: id,
      email: 'test@example.com',
      role: 'viewer',
    }),
  ).toEqual({
    fieldErrors: {
      email: ['Ya hay una invitación pendiente para este correo.'],
    },
  })
})
