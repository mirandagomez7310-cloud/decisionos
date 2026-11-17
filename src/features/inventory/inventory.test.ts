import { beforeEach, expect, it, vi } from 'vitest'
import { getInventory } from './queries'
import { inventorySearchSchema } from './schemas'

const mocks = vi.hoisted(() => ({ client: vi.fn(), role: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }))
vi.mock('@/lib/server/auth', () => ({ requireRole: mocks.role }))

it('aplica valores por defecto y recorta la búsqueda', () => {
  expect(inventorySearchSchema.parse({})).toEqual({
    filtro: 'todos',
    orden: 'valor',
    pagina: 1,
  })
  expect(inventorySearchSchema.parse({ q: '  Tornillo  ' }).q).toBe('Tornillo')
})

it.each([
  { filtro: 'otro' },
  { orden: 'otro' },
  { q: '   ' },
  { q: 'a'.repeat(81) },
  { pagina: '0' },
  { pagina: '-1' },
  { pagina: '1.5' },
  { pagina: ['2'] },
])('rechaza parámetros inválidos %j', (params) => {
  expect(inventorySearchSchema.safeParse(params).success).toBe(false)
})

const summary = { snapshot_on: '2026-11-17', product_count: 60 }
const builder = (data: unknown, count?: number) => ({
  ilike: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  // oxlint-disable-next-line unicorn/no-thenable -- El doble reproduce el builder awaitable de PostgREST.
  then: (resolve: (value: unknown) => void) =>
    resolve({ data, count, error: null }),
})
const total = builder(null, 60)
const rows = builder([])
const rpc = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  mocks.role.mockResolvedValue({ organization: { id: 'org' }, role: 'viewer' })
  mocks.client.mockResolvedValue({ rpc })
  rpc.mockImplementation((name, _args, options) =>
    name === 'inventory_summary'
      ? builder(summary)
      : options.head
        ? total
        : rows,
  )
})

it.each([
  ['valor', 'inventory_value', false, false],
  ['dias', 'days_on_hand', false, false],
  ['sin_venta', 'days_since_sale', false, true],
  ['nombre', 'name', true, false],
] as const)(
  'ordena %s, filtra y ajusta la página en PostgREST',
  async (orden, field, ascending, nullsFirst) => {
    const result = await getInventory(
      'demo',
      inventorySearchSchema.parse({
        orden,
        q: '50%',
        filtro: 'sin_movimiento',
        pagina: '999',
      }),
    )
    expect(result).toMatchObject({
      error: false,
      page: 2,
      pages: 2,
      count: 60,
      summary,
    })
    expect(mocks.role).toHaveBeenCalledWith(
      'demo',
      'owner',
      'admin',
      'analyst',
      'viewer',
    )
    expect(rpc).toHaveBeenCalledWith(
      'inventory_by_product',
      {
        p_organization_id: 'org',
        p_as_of: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
      { count: 'exact', head: true },
    )
    for (const query of [total, rows]) {
      expect(query.ilike).toHaveBeenCalledWith('name', '%50\\%%')
      expect(query.eq).toHaveBeenCalledWith('is_stale', true)
    }
    expect(rows.order).toHaveBeenNthCalledWith(1, field, {
      ascending,
      nullsFirst,
    })
    expect(rows.order).toHaveBeenNthCalledWith(2, 'product_id', {
      ascending: true,
      nullsFirst: false,
    })
    expect(rows.range).toHaveBeenCalledWith(50, 99)
  },
)
