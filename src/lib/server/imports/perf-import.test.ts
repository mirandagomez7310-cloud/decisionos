import { expect, it } from 'vitest'
import { parseFile } from './parse'
import { validateRows } from './validate'

it.skip('perf-import: 10 000 líneas de ventas', async () => {
  const csv =
    'external_ref,sold_on,customer_code,product_sku,quantity,unit_price\n' +
    Array.from(
      { length: 10000 },
      (_, i) => `F${i},2026-01-01,C,P,1,10.00`,
    ).join('\n')
  const start = performance.now()
  const source = await parseFile(Buffer.from(csv), 'perf.csv')
  const mapping = Object.fromEntries(source.headers.map((key) => [key, key]))
  const result = validateRows(source.rows, mapping, 'sales', {
    currency: 'MXN',
  })
  console.log(
    `perf-import: ${result.ok.length} filas en ${(performance.now() - start).toFixed(2)} ms`,
  )
  expect(result.summary).toEqual({ total: 10000, valid: 10000, invalid: 0 })
})
