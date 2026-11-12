import { describe, expect, it } from 'vitest'
import { authSchema, sanitizeNext } from './schemas'
describe('auth schema', () => {
  it('accepts credentials and rejects malformed inputs', () => {
    expect(
      authSchema.safeParse({
        email: 'user@example.com',
        password: 'password123',
        next: '/o/demo',
      }).success,
    ).toBe(true)
    expect(
      authSchema.safeParse({ email: 'invalid', password: 'short', next: '/' })
        .success,
    ).toBe(false)
    expect(authSchema.safeParse(null).success).toBe(false)
  })
  it('keeps internal paths and rejects external or ambiguous redirects', () => {
    expect(sanitizeNext('/o/demo?tab=one#main')).toBe('/o/demo?tab=one#main')
    for (const value of [
      undefined,
      ['/'],
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      '/%2f%2fevil.test',
      '/\nevil.test',
    ])
      expect(sanitizeNext(value)).toBe('/')
    expect(
      authSchema.parse({
        email: 'u@example.com',
        password: 'password123',
        next: '//evil.test',
      }).next,
    ).toBe('/')
  })
})
