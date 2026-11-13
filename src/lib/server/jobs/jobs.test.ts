import { describe, expect, it, vi } from 'vitest'
import { salesBatches } from './handlers/import'
import { batches, checked } from './shared'

describe('jobs', () => {
  const row = (ref: string, rowNumber = 1) => ({
    rowNumber,
    data: { external_ref: ref },
  })
  it('agrupa folios no contiguos sin dividirlos al formar lotes de 2000', () => {
    const rows = Array.from({ length: 2001 }, (_, i) =>
      row(String(i % 3), i + 1),
    )
    const chunks = salesBatches(rows)
    expect(chunks.map((chunk) => chunk.length)).toEqual([1334, 667])
    expect(new Set(chunks[0]!.map((r) => r.data.external_ref))).toEqual(
      new Set(['0', '1']),
    )
    expect(salesBatches([])).toEqual([])
    expect(
      salesBatches(Array.from({ length: 2000 }, () => row('A')))[0],
    ).toHaveLength(2000)
  })
  it('rechaza antes de escribir folios demasiado grandes o cabeceras inconsistentes', () => {
    expect(() =>
      salesBatches(Array.from({ length: 2001 }, () => row('A'))),
    ).toThrow('2000')
    expect(() =>
      salesBatches([
        { rowNumber: 1, data: { external_ref: 'A', currency: 'MXN' } },
        { rowNumber: 2, data: { external_ref: 'A', currency: 'USD' } },
      ]),
    ).toThrow('Cabecera inconsistente')
  })
  it('escribe lotes de hasta 500 y propaga errores del cliente simulado', async () => {
    const insert = vi.fn().mockResolvedValue({ data: null, error: null })
    const db = { from: vi.fn(() => ({ insert })) }
    for (const batch of batches(Array.from({ length: 1001 }, (_, i) => i)))
      await checked(db.from().insert(batch))
    expect(insert.mock.calls.map((call) => call[0].length)).toEqual([
      500, 500, 1,
    ])
    expect(batches([])).toEqual([])
    insert.mockResolvedValueOnce({ data: null, error: { message: 'fallo' } })
    await expect(checked(db.from().insert([]))).rejects.toThrow('fallo')
  })
})
