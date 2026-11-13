import { expect, it, vi } from 'vitest'
import { handleImport } from './import'
import { handleRevert } from './revert'
import type { Client, Job } from '../shared'

const org = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
const job = {
  id: 'job',
  organization_id: org,
  payload: { import_id: id },
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

function client(csv: string, kind = 'sales') {
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
      update: (value: unknown) => {
        call.operation = 'update'
        call.value = value
        return chain
      },
      single: () => chain,
      // oxlint-disable-next-line unicorn/no-thenable -- Simula el query builder awaitable de Supabase.
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(
          resolve({
            error: null,
            data:
              table === 'imports' && call.operation === 'select'
                ? {
                    kind,
                    storage_path: org + '/' + id + '-file.csv',
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
                  : null,
          }),
        ),
    }
    return chain
  })
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: [{ rejected: [] }], error: null })
  const download = vi
    .fn()
    .mockResolvedValue({
      error: null,
      data: { arrayBuffer: async () => Buffer.from(csv) },
    })
  const db = {
    from,
    rpc,
    storage: { from: () => ({ download }) },
  } as unknown as Client
  return { db, calls, rpc }
}

it('reintenta la misma RPC, envía decimales exactos y registra rechazos con raw', async () => {
  const csv =
    'external_ref,sold_on,customer_code,product_sku,quantity,unit_price\nA,2026-01-01,C,P,1,0.10\nA,2026-01-01,C,P,2,0.10\nB,2026-01-01,C,X,1,0.10\nC,2026-01-01,C,P,no,0.10'
  const { db, calls, rpc } = client(csv)
  rpc.mockResolvedValue({
    data: [
      {
        rejected: [
          {
            external_ref: 'B',
            row_number: 3,
            motivo: 'Producto desconocido sin nombre',
          },
        ],
      },
    ],
    error: null,
  })
  await handleImport(db, job)
  await handleImport(db, job)
  expect(rpc).toHaveBeenCalledTimes(2)
  expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1])
  expect(rpc.mock.calls[0]).toEqual([
    'apply_import_sales',
    {
      p_organization_id: org,
      p_import_id: id,
      p_rows: expect.arrayContaining([
        expect.objectContaining({
          row_number: 1,
          line_total: '0.10',
          unit_price: '0.1000',
        }),
      ]),
    },
  ])
  expect(
    calls.some((call) =>
      ['sales', 'sale_lines', 'products', 'customers'].includes(call.table),
    ),
  ).toBe(false)
  expect(
    calls.find(
      (call) =>
        call.table === 'import_rows' &&
        call.operation === 'insert' &&
        (call.value as { row_number: number }[])[0]?.row_number === 3,
    )?.value,
  ).toEqual([
    expect.objectContaining({
      row_number: 3,
      raw: expect.objectContaining({ product_sku: 'X' }),
      error: 'Producto desconocido sin nombre',
    }),
  ])
  expect(
    calls.find(
      (call) => call.table === 'imports' && call.operation === 'update',
    )?.value,
  ).toMatchObject({ status: 'done', ok_count: 2, error_count: 2 })
  expect(calls.find((call) => call.table === 'jobs')?.value).toEqual({
    progress: { done: 4, total: 4 },
  })
  expect(
    calls
      .filter((call) => call.operation === 'delete')
      .every((call) =>
        call.filters.some(
          (filter) => filter[0] === 'organization_id' && filter[1] === org,
        ),
      ),
  ).toBe(true)
})

it('envía catálogos en lotes de 2000, conserva active vacío y actualiza progreso', async () => {
  const csv =
    'sku,name,active\n' +
    Array.from(
      { length: 4001 },
      (_, i) => 'P' + i + ',Producto,' + (i === 0 ? 'false' : ''),
    ).join('\n')
  const { db, calls, rpc } = client(csv, 'products')
  await handleImport(db, job)
  expect(rpc.mock.calls.map((call) => call[1].p_rows.length)).toEqual([
    2000, 2000, 1,
  ])
  expect(rpc.mock.calls[0]![1].p_rows[0]).toMatchObject({ active: false })
  expect(rpc.mock.calls[0]![1].p_rows[1]).not.toHaveProperty('active')
  expect(
    calls.filter((call) => call.table === 'jobs').map((call) => call.value),
  ).toEqual([
    { progress: { done: 2000, total: 4001 } },
    { progress: { done: 4000, total: 4001 } },
    { progress: { done: 4001, total: 4001 } },
  ])
})

it('propaga fallo RPC sin marcar la importación terminada', async () => {
  const { db, calls, rpc } = client('sku,name\nP,Producto', 'products')
  rpc.mockResolvedValue({ data: null, error: { message: 'SQL falló' } })
  await expect(handleImport(db, job)).rejects.toThrow('SQL falló')
  expect(
    calls.some(
      (call) => call.table === 'imports' && call.operation === 'update',
    ),
  ).toBe(false)
})

it('revierte con una sola RPC y audita solo tras éxito', async () => {
  const { db, rpc, calls } = client('')
  await handleRevert(db, job)
  expect(rpc).toHaveBeenCalledWith('revert_import', {
    p_organization_id: org,
    p_import_id: id,
  })
  expect(calls.map((call) => call.table)).toEqual(['audit_log'])
  rpc.mockResolvedValue({ data: null, error: { message: 'SQL falló' } })
  await expect(handleRevert(db, job)).rejects.toThrow('SQL falló')
  expect(calls).toHaveLength(1)
})
