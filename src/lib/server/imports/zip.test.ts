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
  it('usa el registro final que lee fflate aunque haya otro en el comentario', () => {
    const zip = fixture()
    const eocd = zip.lastIndexOf(Buffer.from('504b0506', 'hex'))
    const cd = zip.readUInt32LE(eocd + 16)
    const entryLength =
      46 +
      zip.readUInt16LE(cd + 28) +
      zip.readUInt16LE(cd + 30) +
      zip.readUInt16LE(cd + 32)
    // Copia de la primera entrada declarando 300 MiB y un registro final falso que apunta a ella.
    const entry = Buffer.from(zip.subarray(cd, cd + entryLength))
    entry.writeUInt32LE(300 * 1024 * 1024, 24)
    const fake = Buffer.alloc(22)
    fake.writeUInt32LE(0x06054b50, 0)
    fake.writeUInt16LE(1, 8)
    fake.writeUInt16LE(1, 10)
    fake.writeUInt32LE(entryLength, 12)
    fake.writeUInt32LE(zip.length, 16)
    // El byte final hace que su longitud de comentario no cuadre: fflate lo usa igualmente.
    const comment = Buffer.concat([entry, fake, Buffer.alloc(1)])
    const real = Buffer.from(zip)
    real.writeUInt16LE(comment.length, eocd + 20)
    expect(() => zipUncompressedSize(Buffer.concat([real, comment]))).toThrow(
      'El archivo .xlsx es demasiado grande al descomprimir',
    )
  })
  it('rechaza ZIP64', () => {
    const zip = fixture()
    const eocd = zip.lastIndexOf(Buffer.from('504b0506', 'hex'))
    const locator = Buffer.alloc(20)
    locator.writeUInt32LE(0x07064b50, 0)
    const buffer = Buffer.concat([
      zip.subarray(0, eocd),
      locator,
      zip.subarray(eocd),
    ])
    expect(() => zipUncompressedSize(buffer)).toThrow(
      'El archivo .xlsx es demasiado grande al descomprimir',
    )
  })
})
