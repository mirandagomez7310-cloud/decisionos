// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { zipUncompressedSize } from './zip'

const fixture = () =>
  readFileSync(new URL('./__fixtures__/minimal.xlsx', import.meta.url))

describe('zipUncompressedSize', () => {
  it('suma una fixture ZIP válida', () => {
    expect(zipUncompressedSize(fixture())).toBeGreaterThan(0)
  })
  it('rechaza una entrada que declara 300 MiB', () => {
    const buffer = fixture()
    buffer.writeUInt32LE(
      300 * 1024 * 1024,
      buffer.indexOf(Buffer.from('504b0102', 'hex')) + 24,
    )
    expect(() => zipUncompressedSize(buffer)).toThrow(
      'El archivo .xlsx es demasiado grande al descomprimir',
    )
  })
  it.each([
    Buffer.alloc(0),
    Buffer.from('sin EOCD'),
    fixture().subarray(0, -1),
  ])('rechaza directorios ausentes o truncados', (buffer) => {
    expect(() => zipUncompressedSize(buffer)).toThrow(
      'El archivo .xlsx es demasiado grande al descomprimir',
    )
  })
  it('rechaza una firma de entrada inválida', () => {
    const buffer = fixture()
    buffer.writeUInt32LE(0, buffer.indexOf(Buffer.from('504b0102', 'hex')))
    expect(() => zipUncompressedSize(buffer)).toThrow(
      'El archivo .xlsx es demasiado grande al descomprimir',
    )
  })
})
