// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createCsp, SONNER_STYLE_HASH } from './csp'
describe('CSP', () => {
  it('matches the style injected by installed Sonner', () => {
    const source = readFileSync('node_modules/sonner/dist/index.mjs', 'utf8')
    const match = source.match(/__insertCSS\(("(?:[^"\\]|\\.)*")\)/)
    expect(match).not.toBeNull()
    const css: string = JSON.parse(match![1]!)
    expect('sha256-' + createHash('sha256').update(css).digest('base64')).toBe(
      SONNER_STYLE_HASH,
    )
  })
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
