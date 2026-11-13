import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  client: vi.fn(),
  admin: vi.fn(),
  after: vi.fn(),
  parse: vi.fn(),
}))
vi.mock('@/lib/server/auth', () => ({ requireRoleForAction: mocks.auth }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/lib/server/imports/parse', () => ({ parseFile: mocks.parse }))
vi.mock('next/cache', () => ({ refresh: vi.fn() }))
vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
import {
  confirmImport,
  revertImport,
  saveMapping,
  uploadImport,
} from './actions'
const organizationId = '11111111-1111-4111-8111-111111111111'
const importId = '22222222-2222-4222-8222-222222222222'
function form() {
  const result = new FormData()
  result.set('organizationId', organizationId)
  result.set('importId', importId)
  return result
}
function query(result: object) {
  const chain = Object.assign(Promise.resolve(result), {
    eq: vi.fn(),
    gt: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  })
  for (const method of [
    'eq',
    'gt',
    'select',
    'update',
    'insert',
    'delete',
  ] as const)
    chain[method].mockReturnValue(chain)
  return chain
}
beforeEach(() => {
  vi.resetAllMocks()
})
it('rechaza todas las mutaciones sin rol autorizado antes de usar servicio', async () => {
  mocks.auth.mockResolvedValue({ ok: false, error: 'forbidden' })
  const upload = form()
  upload.set('kind', 'products')
  upload.set('file', new File(['sku,name\nA,Uno'], 'a.csv'))
  for (const [action, input] of [
    [uploadImport, upload],
    [saveMapping, form()],
    [confirmImport, form()],
    [revertImport, form()],
  ] as const) {
    expect(await action(input)).toHaveProperty('error')
  }
  expect(mocks.auth).toHaveBeenCalledWith(organizationId, 'owner', 'admin')
  expect(mocks.admin).not.toHaveBeenCalled()
  expect(mocks.client).not.toHaveBeenCalled()
})
function authorize() {
  mocks.auth.mockResolvedValue({
    ok: true,
    data: { user: { id: importId }, role: 'admin' },
  })
  const organization = query({
    data: { slug: 'demo', currency: 'MXN' },
    error: null,
  })
  const audit = query({ error: null })
  const item = query({
    data: {
      id: importId,
      kind: 'products',
      status: 'pending',
      storage_path: organizationId + '/a.csv',
      original_filename: 'a.csv',
    },
    error: null,
  })
  mocks.client.mockResolvedValue({
    from: (table: string) =>
      table === 'organizations'
        ? organization
        : table === 'imports'
          ? item
          : audit,
  })
  return { audit, item }
}
it('confirma con condición de estado y organización, audita y programa el worker', async () => {
  const { audit } = authorize()
  const item = query({ data: { id: importId }, error: null })
  const job = query({ error: null })
  mocks.admin.mockReturnValue({
    from: (table: string) => (table === 'imports' ? item : job),
  })
  expect(await confirmImport(form())).toEqual({ ok: true })
  expect(item.eq).toHaveBeenCalledWith('organization_id', organizationId)
  expect(item.eq).toHaveBeenCalledWith('id', importId)
  expect(item.eq).toHaveBeenCalledWith('status', 'pending')
  expect(item.gt).toHaveBeenCalledWith('ok_count', 0)
  expect(job.insert).toHaveBeenCalledWith({
    organization_id: organizationId,
    kind: 'import',
    payload: { import_id: importId },
  })
  expect(audit.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      action: 'imports.confirmed',
      organization_id: organizationId,
    }),
  )
  expect(mocks.after).toHaveBeenCalledOnce()
})
it('no crea un job cuando el estado o el número de filas impiden confirmar', async () => {
  authorize()
  const item = query({ data: null, error: null })
  const from = vi.fn().mockReturnValue(item)
  mocks.admin.mockReturnValue({ from })
  expect(await confirmImport(form())).toHaveProperty('error')
  expect(from).not.toHaveBeenCalledWith('jobs')
  expect(mocks.after).not.toHaveBeenCalled()
})
it('revierte solo desde done y crea un trabajo revert_import', async () => {
  authorize()
  const item = query({ data: { id: importId }, error: null })
  const job = query({ error: null })
  mocks.admin.mockReturnValue({
    from: (table: string) => (table === 'imports' ? item : job),
  })
  expect(await revertImport(form())).toEqual({ ok: true })
  expect(item.eq).toHaveBeenCalledWith('status', 'done')
  expect(item.gt).not.toHaveBeenCalled()
  expect(job.insert).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'revert_import' }),
  )
})
it('restaura el estado si falla la creación del job', async () => {
  authorize()
  const item = query({ data: { id: importId }, error: null })
  const job = query({ error: { code: 'error' } })
  mocks.admin.mockReturnValue({
    from: (table: string) => (table === 'imports' ? item : job),
  })
  expect(await confirmImport(form())).toHaveProperty('error')
  expect(item.update).toHaveBeenLastCalledWith({ status: 'pending' })
  expect(mocks.after).not.toHaveBeenCalled()
})
it('rechaza mapeos duplicados o incompletos antes de escribir', async () => {
  authorize()
  const input = form()
  expect(await saveMapping(input)).toHaveProperty('error')
  input.set('mapping.sku', 'Código')
  input.set('mapping.name', 'Código')
  expect(await saveMapping(input)).toHaveProperty('error')
  expect(mocks.admin).not.toHaveBeenCalled()
})
it('rechaza cabeceras inventadas antes de escribir con servicio', async () => {
  authorize()
  const input = form()
  input.set('mapping.sku', 'Inventado')
  input.set('mapping.name', 'Nombre')
  const from = vi.fn()
  mocks.admin.mockReturnValue({
    from,
    storage: {
      from: () => ({
        download: async () => ({
          data: { arrayBuffer: async () => new ArrayBuffer(0) },
          error: null,
        }),
      }),
    },
  })
  mocks.parse.mockResolvedValue({
    headers: ['Código', 'Nombre'],
    rows: [],
    warnings: [],
  })
  expect(await saveMapping(input)).toEqual({
    error: 'El mapeo contiene cabeceras que no existen en el archivo.',
  })
  expect(from).not.toHaveBeenCalled()
})

it('valida las filas y guarda solo errores con su raw y los contadores', async () => {
  const { audit } = authorize()
  const input = form()
  input.set('mapping.sku', 'Código')
  input.set('mapping.name', 'Nombre')
  const item = query({ data: { id: importId }, error: null })
  const rows = query({ error: null })
  mocks.admin.mockReturnValue({
    from: (table: string) => (table === 'imports' ? item : rows),
    storage: {
      from: () => ({
        download: async () => ({
          data: { arrayBuffer: async () => new ArrayBuffer(0) },
          error: null,
        }),
      }),
    },
  })
  mocks.parse.mockResolvedValue({
    headers: ['Código', 'Nombre'],
    rows: [
      { Código: 'A', Nombre: 'Uno' },
      { Código: 'B', Nombre: '' },
    ],
    warnings: [],
  })
  await saveMapping(input)
  expect(rows.delete).toHaveBeenCalledOnce()
  expect(rows.eq).toHaveBeenCalledWith('organization_id', organizationId)
  expect(rows.eq).toHaveBeenCalledWith('import_id', importId)
  expect(rows.insert).toHaveBeenCalledWith([
    expect.objectContaining({
      organization_id: organizationId,
      import_id: importId,
      row_number: 2,
      raw: { Código: 'B', Nombre: '' },
      error: expect.any(String),
    }),
  ])
  expect(item.update).toHaveBeenLastCalledWith({
    row_count: 2,
    ok_count: 1,
    error_count: 1,
  })
  expect(audit.insert).toHaveBeenCalledWith(
    expect.objectContaining({ action: 'imports.mapping_saved' }),
  )
})

it('sube con cliente de usuario y respeta el grant de imports al insertar', async () => {
  const { item } = authorize()
  const upload = vi.fn().mockResolvedValue({ error: null })
  const db = await mocks.client()
  db.storage = { from: () => ({ upload }) }
  const count = query({ error: null })
  mocks.admin.mockReturnValue({ from: () => count })
  mocks.parse.mockResolvedValue({
    headers: ['sku', 'name'],
    rows: [{ sku: 'A', name: 'Uno' }],
    warnings: [],
  })
  const input = form()
  const file = new File(['sku,name\nA,Uno'], 'mi archivo.csv')
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new ArrayBuffer(0),
  })
  input.set('file', file)
  input.set('kind', 'products')
  await uploadImport(input)
  expect(upload).toHaveBeenCalledWith(
    expect.stringMatching(
      new RegExp(`^${organizationId}/[a-f0-9-]+-mi_archivo\\.csv$`),
    ),
    file,
    { contentType: 'text/csv' },
  )
  expect(item.insert).toHaveBeenCalledWith({
    organization_id: organizationId,
    kind: 'products',
    storage_path: expect.any(String),
    original_filename: file.name,
    column_mapping: expect.objectContaining({ sku: 'sku', name: 'name' }),
    created_by: importId,
  })
  expect(count.update).toHaveBeenCalledWith({ row_count: 1 })
  expect(count.eq).toHaveBeenCalledWith('organization_id', organizationId)
})
