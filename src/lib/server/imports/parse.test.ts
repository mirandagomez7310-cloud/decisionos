// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseFile } from './parse'

it('rechaza el XLSX manipulado antes de descomprimir', async () => {
  const buffer = readFileSync(
    new URL('./__fixtures__/minimal.xlsx', import.meta.url),
  )
  buffer.writeUInt32LE(
    300 * 1024 * 1024,
    buffer.indexOf(Buffer.from('504b0102', 'hex')) + 24,
  )
  await expect(parseFile(buffer, 'bomba.xlsx')).rejects.toThrow(
    'El archivo .xlsx es demasiado grande al descomprimir',
  )
})
