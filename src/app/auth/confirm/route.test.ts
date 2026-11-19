import { beforeEach, expect, it, vi } from 'vitest'
import { GET } from './route'

const { verifyOtp } = vi.hoisted(() => ({ verifyOtp: vi.fn() }))
vi.mock('@/env', () => ({ env: { APP_URL: 'https://app.example' } }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}))
vi.mock('next/navigation', () => ({
  redirect: (path: string): never => {
    throw new Error(path)
  },
}))

const base = 'https://app.example/auth/confirm?token_hash=x&type='
const errorPath = '/login?error=confirmation'

beforeEach(() => {
  verifyOtp.mockReset()
})

it('verifies the token and redirects to next', async () => {
  verifyOtp.mockResolvedValue({ error: null })
  const next = encodeURIComponent(
    'https://app.example/invitations/token?a=1&b=2',
  )
  await expect(GET(new Request(base + 'email&next=' + next))).rejects.toThrow(
    '/invitations/token?a=1&b=2',
  )
  expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'x', type: 'email' })
})

it('rejects other OTP types before verification', async () => {
  await expect(GET(new Request(base + 'recovery'))).rejects.toThrow(errorPath)
  expect(verifyOtp).not.toHaveBeenCalled()
})

it('redirects to login when verification returns an error', async () => {
  verifyOtp.mockResolvedValue({ error: new Error('OTP expired') })
  await expect(GET(new Request(base + 'email'))).rejects.toThrow(errorPath)
})

it('redirects to login when verification throws', async () => {
  verifyOtp.mockRejectedValue(new Error('Connection failed'))
  await expect(GET(new Request(base + 'email'))).rejects.toThrow(errorPath)
})
