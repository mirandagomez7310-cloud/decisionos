import { beforeEach, expect, it, vi } from 'vitest'
import { getReceivables } from './queries'
import { receivablesSearchSchema } from './schemas'

const mocks = vi.hoisted(() => ({ client: vi.fn(), role: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }))
vi.mock('@/lib/server/auth', () => ({ requireRole: mocks.role }))

it('aplica valores por defecto y recorta la búsqueda', () => {
  expect(receivablesSearchSchema.parse({})).toEqual({
    riesgo: 'todos',
    orden: 'vencido',
    pagina: 1,
  })
  expect(receivablesSearchSchema.parse({ q: '  Cliente  ' }).q).toBe('Cliente')
})

it.each([
  { riesgo: 'otro' },
  { orden: 'otro' },
  { q: ' ' },
  { q: 'a'.repeat(81) },
  { pagina: '0' },
  { pagina: '-1' },
  { pagina: '1.5' },
  { pagina: ['2'] },
])('rechaza parámetros inválidos %j', (params) => {
  expect(receivablesSearchSchema.safeParse(params).success).toBe(false)
})

const builder = (data: unknown, count?: number) => ({
  ilike: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  // oxlint-disable-next-line unicorn/no-thenable -- Reproduce el builder awaitable de PostgREST.
  then: (resolve: (value: unknown) => void) =>
    resolve({ data, count, error: null }),
})
const alto = builder(null, 60)
const medio = builder(null, 3)
const bajo = builder(null, 1)
const rows = builder([])
const rpc = vi.fn()
const from = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockReset()
  mocks.role.mockResolvedValue({ organization: { id: 'org' }, role: 'viewer' })
  mocks.client.mockResolvedValue({ rpc, from })
  rpc
    .mockReturnValueOnce(builder({ customer_count: 72 }))
    .mockReturnValueOnce(alto)
    .mockReturnValueOnce(medio)
    .mockReturnValueOnce(bajo)
    .mockReturnValueOnce(rows)
})

it.each([
  ['vencido', 'overdue_balance', false],
  ['saldo', 'open_balance', false],
  ['dias', 'max_days_overdue', false],
  ['credito', 'credit_used_pct', false],
  ['nombre', 'name', true],
] as const)(
  'filtra, ordena %s con nulos al final y acota la página',
  async (orden, field, ascending) => {
    const result = await getReceivables(
      'demo',
      receivablesSearchSchema.parse({
        riesgo: 'alto',
        q: '50%',
        orden,
        pagina: '999',
      }),
    )
    expect(result).toMatchObject({
      state: 'open',
      page: 2,
      pages: 2,
      count: 60,
      counts: { todos: 64, alto: 60, medio: 3, bajo: 1 },
    })
    expect(mocks.role).toHaveBeenCalledWith(
      'demo',
      'owner',
      'admin',
      'analyst',
      'viewer',
    )
    for (const [index, risk, query] of [
      [2, 'alto', alto],
      [3, 'medio', medio],
      [4, 'bajo', bajo],
    ] as const) {
      expect(rpc).toHaveBeenNthCalledWith(
        index,
        'receivables_by_customer',
        {
          p_organization_id: 'org',
          p_as_of: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        },
        { count: 'exact', head: true },
      )
      expect(query.eq).toHaveBeenCalledWith('risk', risk)
    }
    for (const query of [alto, medio, bajo, rows])
      expect(query.ilike).toHaveBeenCalledWith('name', '%50\\%%')
    expect(rows.eq).toHaveBeenCalledWith('risk', 'alto')
    expect(rows.order).toHaveBeenNthCalledWith(1, field, {
      ascending,
      nullsFirst: false,
    })
    expect(rows.order).toHaveBeenNthCalledWith(2, 'customer_id', {
      ascending: true,
      nullsFirst: false,
    })
    expect(rows.range).toHaveBeenCalledWith(50, 99)
  },
)

it.each([
  ['empty', []],
  ['paid', [{ id: 'receipt' }]],
] as const)(
  'distingue el estado %s cuando no hay saldo abierto',
  async (state, accounts) => {
    rpc.mockReset()
    rpc
      .mockReturnValueOnce(builder({ customer_count: 0 }))
      .mockReturnValue(builder(null, 0))
    const existence = builder(accounts)
    from.mockReturnValue(existence)
    expect(
      await getReceivables('demo', receivablesSearchSchema.parse({})),
    ).toMatchObject({ state })
    expect(from).toHaveBeenCalledWith('receivables')
    expect(existence.eq).toHaveBeenCalledWith('organization_id', 'org')
    expect(existence.limit).toHaveBeenCalledWith(1)
  },
)
