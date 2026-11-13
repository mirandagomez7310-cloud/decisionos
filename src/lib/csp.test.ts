// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createCsp } from './csp'
describe('CSP', () => {
  it('restricts production scripts and upgrades only HTTPS', () => {
    const policy = createCsp('test', 'https://example.supabase.co', false)
    expect(policy).toContain("'nonce-test' 'strict-dynamic'")
    expect(policy).not.toContain('unsafe-eval')
    expect(policy).toContain('wss://example.supabase.co')
    expect(policy).toContain('upgrade-insecure-requests')
    expect(createCsp('test', 'http://127.0.0.1:54321', true)).not.toContain(
      'upgrade-insecure-requests',
    )
    expect(createCsp('test', 'http://127.0.0.1:54321', true)).toContain(
      'unsafe-eval',
    )
  })
})
