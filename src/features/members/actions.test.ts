import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), client: vi.fn() }))
vi.mock('@/lib/server/auth', () => ({ requireRoleForAction: mocks.auth }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }))
vi.mock('next/cache', () => ({ refresh: vi.fn() }))
import { changeMemberRole, removeMember } from './actions'
const input = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000002',
}
beforeEach(() => {
  vi.resetAllMocks()
})
it('rechaza ascenso a owner por admin', async () => {
  mocks.auth.mockResolvedValue({
    ok: true,
    data: { role: 'admin', user: { id: input.userId } },
  })
  expect(await changeMemberRole({ ...input, role: 'owner' })).toEqual({
    error: 'No tienes permiso para esta acción',
  })
  expect(mocks.client).not.toHaveBeenCalled()
})
it('una sesión caducada no ejecuta bajas', async () => {
  mocks.auth.mockResolvedValue({ ok: false, error: 'unauthenticated' })
  expect(await removeMember(input)).toEqual({
    error: expect.stringContaining('Tu sesión caducó'),
  })
})
it('traduce la protección del último owner', async () => {
  mocks.auth.mockResolvedValue({
    ok: true,
    data: { role: 'owner', user: { id: input.userId } },
  })
  const query = {
    eq: vi.fn(),
    select: vi.fn().mockResolvedValue({ error: { code: '23514' }, data: null }),
  }
  query.eq.mockReturnValue(query)
  mocks.client.mockResolvedValue({ from: () => ({ update: () => query }) })
  expect(await changeMemberRole({ ...input, role: 'admin' })).toEqual({
    error: 'La organización necesita al menos un propietario',
  })
})
