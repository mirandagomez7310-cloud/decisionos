import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(path)
  }),
}))
vi.mock('react', () => ({ cache: (fn: unknown) => fn }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-pathname': '/o/demo' }),
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}))
import { getMembership, requireRole, requireRoleForAction } from './auth'
describe('membership authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mocks.maybeSingle,
    }
    mocks.from.mockReturnValue(query)
  })
  it('returns unauthenticated without querying memberships', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await requireRoleForAction('org-1', 'owner')).toEqual({
      ok: false,
      error: 'unauthenticated',
    })
    expect(mocks.from).not.toHaveBeenCalled()
    await expect(requireRole('demo', 'owner')).rejects.toThrow(
      '/login?next=%2Fo%2Fdemo',
    )
  })
  it('reads current memberships and refuses missing or insufficient roles', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { role: 'viewer' },
      error: null,
    })
    expect(await requireRoleForAction('org-1', 'owner', 'admin')).toEqual({
      ok: false,
      error: 'forbidden',
    })
    expect(mocks.from).toHaveBeenCalledWith('memberships')
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await requireRoleForAction('org-1', 'viewer')).toEqual({
      ok: false,
      error: 'forbidden',
    })
    mocks.maybeSingle.mockResolvedValue({
      data: { role: 'admin' },
      error: null,
    })
    expect(await requireRoleForAction('org-1', 'admin')).toMatchObject({
      ok: true,
      data: { role: 'admin' },
    })
  })
  it('checks the user membership after resolving the organization', async () => {
    mocks.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'org-1', slug: 'demo' },
        error: null,
      })
      .mockResolvedValueOnce({ data: { role: 'analyst' }, error: null })
    expect(await getMembership('demo')).toMatchObject({
      organization: { id: 'org-1' },
      role: 'analyst',
    })
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(requireRole('demo', 'owner')).rejects.toThrow('/no-access')
  })
})
