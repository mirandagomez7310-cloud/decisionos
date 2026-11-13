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

it('no descomprime más de lo que declara el directorio central', async () => {
  const buffer = readFileSync(
    new URL('./__fixtures__/minimal.xlsx', import.meta.url),
  )
  await expect(parseFile(buffer, 'ok.xlsx')).resolves.toBeDefined()
  // Directorio central que miente a la baja: el parser debe quedarse en lo declarado y fallar.
  for (
    let at = buffer.indexOf(Buffer.from('504b0102', 'hex'));
    at !== -1;
    at = buffer.indexOf(Buffer.from('504b0102', 'hex'), at + 4)
  )
    buffer.writeUInt32LE(1, at + 24)
  await expect(parseFile(buffer, 'mentira.xlsx')).rejects.toThrow()
})
