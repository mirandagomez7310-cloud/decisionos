import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(path)
  }),
}))
vi.mock('@/lib/server/auth', () => ({ getUser: mocks.getUser }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
import { createOrganization } from './actions'
const input = { name: 'Demo', slug: 'demo' }
describe('create organization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({ id: 'user-1' })
  })
  it('validates input before accessing auth or the database', async () => {
    expect(await createOrganization({ name: '', slug: '--' })).toHaveProperty(
      'fieldErrors.slug',
    )
    expect(mocks.getUser).not.toHaveBeenCalled()
  })
  it('preserves an expired session as a structured error', async () => {
    mocks.getUser.mockResolvedValue(null)
    expect(await createOrganization(input)).toEqual({
      ok: false,
      error: 'unauthenticated',
    })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('maps duplicate slugs to the slug field', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '23505' } })
    expect(await createOrganization(input)).toHaveProperty('fieldErrors.slug')
  })
  it('uses the organization row returned by the RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: { id: 'org-1', slug: 'demo' },
      error: null,
    })
    await expect(createOrganization(input)).rejects.toThrow('/o/demo')
    expect(mocks.rpc).toHaveBeenCalledWith('create_organization', input)
  })
  it('does not expose transport errors to the client', async () => {
    mocks.rpc.mockRejectedValue(new Error('private database details'))
    const result = await createOrganization(input)
    expect(result).toMatchObject({ ok: false })
    expect(JSON.stringify(result)).not.toContain('private database details')
  })
})
