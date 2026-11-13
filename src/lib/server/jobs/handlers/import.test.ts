import { expect, it, vi } from 'vitest'
import { handleImport } from './import'
import type { Client, Job } from '../shared'

it('reintentar reemplaza líneas completas, conserva tenant y registra errores', async () => {
  const csv =
    'external_ref,sold_on,customer_code,product_sku,quantity,unit_price\nA,2026-01-01,C,P,1,0.10\nA,2026-01-01,C,P,2,0.10\nB,2026-01-01,C,P,no,0.10'
  const buffer = Buffer.from(csv)
  const calls: {
    table: string
    operation: string
    value?: unknown
    filters: unknown[][]
  }[] = []
  const from = vi.fn((table: string) => {
    const call = {
      table,
      operation: 'select',
      value: undefined as unknown,
      filters: [] as unknown[][],
    }
    calls.push(call)
    const chain = {
      select: () => chain,
      eq: (...args: unknown[]) => {
        call.filters.push(args)
        return chain
      },
      delete: () => {
        call.operation = 'delete'
        return chain
      },
      insert: (value: unknown) => {
        call.operation = 'insert'
        call.value = value
        return chain
      },
      upsert: (value: unknown) => {
        call.operation = 'upsert'
        call.value = value
        return chain
      },
      update: (value: unknown) => {
        call.operation = 'update'
        call.value = value
        return chain
      },
      single: () => chain,
      maybeSingle: () => chain,
      // oxlint-disable-next-line unicorn/no-thenable -- Simula el query builder awaitable de Supabase.
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(
          resolve({
            error: null,
            data:
              table === 'imports' && call.operation === 'select'
                ? {
                    kind: 'sales',
                    storage_path: 'org/file.csv',
                    original_filename: 'file.csv',
                    column_mapping: Object.fromEntries(
                      csv
                        .split('\n')[0]!
                        .split(',')
                        .map((key) => [key, key]),
                    ),
                  }
                : table === 'organizations'
                  ? { currency: 'MXN' }
                  : ['products', 'customers', 'sales'].includes(table)
                    ? { id: table + '-id' }
                    : null,
          }),
        ),
    }
    return chain
  })
  const db = {
    from,
    storage: {
      from: () => ({
        download: async () => ({
          error: null,
          data: { arrayBuffer: async () => buffer },
        }),
      }),
    },
  } as unknown as Client
  const job = {
    id: 'job',
    organization_id: 'org',
    payload: { import_id: 'import' },
    kind: 'import',
    status: 'running',
    attempts: 1,
    max_attempts: 3,
    created_at: '',
    finished_at: null,
    locked_at: null,
    locked_by: null,
    last_error: null,
    progress: {},
    run_after: '',
  } satisfies Job
  await handleImport(db, job)
  await handleImport(db, job)
  const lines = calls.filter((call) => call.table === 'sale_lines')
  expect(lines.map((call) => call.operation)).toEqual([
    'delete',
    'insert',
    'delete',
    'insert',
  ])
  expect(lines[1]!.value).toHaveLength(2)
  expect(lines[3]!.value).toEqual(lines[1]!.value)
  expect(calls.find((call) => call.table === 'sales')!.value).toMatchObject({
    subtotal: '0.30',
    total: '0.30',
    organization_id: 'org',
    source_import_id: 'import',
  })
  expect(
    calls
      .filter((call) => call.operation === 'delete')
      .every((call) =>
        call.filters.some(
          (filter) => filter[0] === 'organization_id' && filter[1] === 'org',
        ),
      ),
  ).toBe(true)
  expect(
    calls.find(
      (call) => call.table === 'imports' && call.operation === 'update',
    )!.value,
  ).toMatchObject({ status: 'done', ok_count: 2, error_count: 1 })
})
