import 'server-only'
import Papa from 'papaparse'
import { readSheet } from 'read-excel-file/node'
import { normalizeHeader } from './mapping'
import { zipUncompressedSize } from './zip'

function checkHeaders(headers: string[]) {
  if (!headers.length || headers.some((header) => !header.trim()))
    throw new Error('El archivo tiene cabeceras vacías o no tiene cabecera')
  if (new Set(headers.map(normalizeHeader)).size !== headers.length)
    throw new Error('El archivo tiene cabeceras duplicadas')
}

export async function parseFile(
  buffer: Buffer,
  filename: string,
): Promise<{
  headers: string[]
  rows: Record<string, string>[]
  warnings: string[]
}> {
  // shortcut: archivo entero en memoria (máximo 25 MiB); pasar a streaming si un archivo real supera el tiempo de función.
  if (buffer.length > 25 * 1024 * 1024)
    throw new Error('El archivo supera el límite de 25 MiB')
  if (!buffer.length) throw new Error('El archivo está vacío')
  const extension = filename.split('.').pop()?.toLowerCase()
  if (extension === 'xls') throw new Error('Guarda el archivo como .xlsx')
  const warnings: string[] = []
  let headers: string[]
  let rows: Record<string, string>[]
  if (extension === 'xlsx') {
    zipUncompressedSize(buffer)
    const data = await readSheet(buffer, {
      trim: false,
      parseNumber: (value) => value,
    })
    const text = (value: unknown) =>
      value instanceof Date
        ? value.toISOString().slice(0, 10)
        : value == null
          ? ''
          : String(value)
    headers = (data[0] ?? []).map((value) => text(value).trim())
    checkHeaders(headers)
    rows = data.slice(1).map((row) => {
      if (row.length > headers.length)
        throw new Error('Hay datos en columnas sin cabecera')
      return Object.fromEntries(
        headers.map((header, index) => [header, text(row[index])]),
      )
    })
  } else if (extension === 'csv') {
    let content: string
    const bytes = buffer.subarray(
      buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? 3 : 0,
    )
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      content = new TextDecoder('windows-1252').decode(bytes)
      warnings.push('El archivo no es UTF-8; se ha leído como Windows-1252')
    }
    if (!content.trim()) throw new Error('El archivo está vacío')
    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      beforeFirstChunk: (chunk) => {
        const first = Papa.parse<string[]>(chunk, {
          preview: 1,
          skipEmptyLines: 'greedy',
        })
        checkHeaders((first.data[0] ?? []).map((header) => header.trim()))
        return chunk
      },
    })
    headers = result.meta.fields ?? []
    checkHeaders(headers)
    const errors = result.errors.filter(
      (error) => error.code !== 'UndetectableDelimiter',
    )
    if (errors.length) throw new Error(`CSV inválido: ${errors[0]!.message}`)
    rows = result.data
  } else throw new Error('Formato no admitido; usa CSV o .xlsx')
  if (!rows.length) throw new Error('El archivo no contiene filas de datos')
  if (rows.length > 100_000)
    throw new Error('El archivo supera el límite de 100 000 filas')
  return { headers, rows, warnings }
}
