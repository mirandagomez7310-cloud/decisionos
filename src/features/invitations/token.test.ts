// @vitest-environment node
import { expect, it } from 'vitest'
import { generateInvitationToken, hashToken } from './token'
it('calcula SHA-256 de UTF-8 conocido', async () => {
  expect(await hashToken('abc')).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  )
})
it('genera 32 bytes aleatorios y solo deriva su hash', async () => {
  const first = await generateInvitationToken()
  const second = await generateInvitationToken()
  expect(first.token).toMatch(/^[0-9a-f]{64}$/)
  expect(first.hash).toBe(await hashToken(first.token))
  expect(second.token).not.toBe(first.token)
})
