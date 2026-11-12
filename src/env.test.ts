import { describe, expect, it } from 'vitest'
import { clientEnvSchema, env, serverEnvSchema } from '@/env'

describe('environment', () => {
  it('accepts valid client and server variables', () => {
    expect(clientEnvSchema.safeParse(env).success).toBe(true)
    expect(serverEnvSchema.safeParse(env).success).toBe(true)
  })

  it('rejects invalid URLs and empty or missing keys', () => {
    expect(
      clientEnvSchema.safeParse({ ...env, NEXT_PUBLIC_SUPABASE_URL: 'invalid' })
        .success,
    ).toBe(false)
    expect(
      clientEnvSchema.safeParse({
        ...env,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
      }).success,
    ).toBe(false)
    expect(serverEnvSchema.safeParse({ SUPABASE_SECRET_KEY: '' }).success).toBe(
      false,
    )
    expect(serverEnvSchema.safeParse({}).success).toBe(false)
  })
})
