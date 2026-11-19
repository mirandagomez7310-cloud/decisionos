import { expect, it, vi } from 'vitest'
import { authenticate } from './actions'

const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }))
vi.mock('@/env', () => ({ env: { APP_URL: 'https://app.example' } }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signUp } }),
}))

it('sends an absolute confirmation redirect and preserves the email notice', async () => {
  signUp.mockResolvedValue({ data: { session: null }, error: null })
  const email = 'user@example.com'
  const password = 'password123'
  const next = '/invitations/token'
  await expect(
    authenticate('signup', { email, password, next }),
  ).resolves.toEqual({
    ok: false,
    error: 'Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.',
  })
  expect(signUp).toHaveBeenCalledWith({
    email,
    password,
    options: { emailRedirectTo: 'https://app.example/invitations/token' },
  })
})
