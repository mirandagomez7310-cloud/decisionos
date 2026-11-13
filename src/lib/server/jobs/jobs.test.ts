import { describe, expect, it, vi } from 'vitest'
import { groupSales, sumMoney } from './handlers/import'
import { batches, checked } from './shared'

describe('jobs', () => {
  it('suma centésimas exactas, negativos y comprueba el límite SQL', () => {
    expect(sumMoney(['0.10', '0.20'])).toBe('0.30')
    expect(sumMoney(['-1.01', '0.20'])).toBe('-0.81')
    expect(() => sumMoney(['999999999999.99', '0.01'])).toThrow()
  })
  it('agrupa folios y suma el impuesto de cabecera una sola vez', () => {
    const data = {
      external_ref: 'A',
      customer_code: 'C',
      sold_on: '2026-01-01',
      currency: 'MXN',
      status: 'completed',
      tax: '0.16',
      line_total: '0.10',
    }
    const groups = groupSales([
      { rowNumber: 1, data },
      { rowNumber: 2, data },
      { rowNumber: 3, data: { ...data, external_ref: 'B' } },
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]!.header).toMatchObject({
      subtotal: '0.20',
      tax: '0.16',
      total: '0.36',
    })
    expect(() =>
      groupSales([
        { rowNumber: 1, data },
        { rowNumber: 2, data: { ...data, currency: 'USD' } },
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
