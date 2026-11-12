import { describe, expect, it } from 'vitest'
import { organizationSchema, suggestSlug } from './schemas'
describe('organization schema', () => {
  it('uses the exact SQL slug constraint', () => {
    for (const slug of ['a', 'abc', 'a-b', 'a'.repeat(40)])
      expect(organizationSchema.safeParse({ name: 'Demo', slug }).success).toBe(
        true,
      )
    for (const slug of ['', 'ab', '-abc', 'abc-', 'ABC', 'a_b', 'a'.repeat(41)])
      expect(organizationSchema.safeParse({ name: 'Demo', slug }).success).toBe(
        false,
      )
    expect(
      organizationSchema.safeParse({ name: ' ', slug: 'demo' }).success,
    ).toBe(false)
  })
  it('suggests normalized slugs', () => {
    expect(suggestSlug('  Distribución México  ')).toBe('distribucion-mexico')
    expect(suggestSlug('a'.repeat(50))).toHaveLength(40)
  })
})
