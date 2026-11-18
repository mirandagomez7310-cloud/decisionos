import { escapeIlike } from './shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { marginOrders, marginSearchSchema, salesSearchSchema } from './schemas'
import { getAnalysis } from './queries'

const mocks = vi.hoisted(() => ({ client: vi.fn(), role: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }))
vi.mock('@/lib/server/auth', () => ({ requireRole: mocks.role }))

describe('parámetros de análisis', () => {
  for (const schema of [salesSearchSchema, marginSearchSchema]) {
    it('aplica valores por defecto y recorta la búsqueda', () => {
      expect(schema.parse({})).toMatchObject({
        periodo: 'mtd',
        vista: 'productos',
        pagina: 1,
      })
      expect(schema.parse({ q: '  Tornillo  ' }).q).toBe('Tornillo')
    })
    it('rechaza parámetros inválidos', () => {
      for (const params of [
        { pagina: '0' },
        { pagina: '-1' },
        { pagina: '1.5' },
        { pagina: ['2'] },
        { q: '   ' },
        { q: 'a'.repeat(81) },
        { q: ['a'] },
        { vista: 'otros' },
        { periodo: 'ayer' },
        { orden: 'otro' },
      ])
        expect(schema.safeParse(params).success, JSON.stringify(params)).toBe(
          false,
        )
    })
  }
  it('escapa los comodines y la barra de ilike', () => {
    expect(escapeIlike('50%_\\')).toBe('50\\%\\_\\\\')
    expect(escapeIlike('Tuerca')).toBe('Tuerca')
  })
})

describe('consultas con RLS y paginación en servidor', () => {
  type Call = { method: string; args: unknown[] }
  let calls: Call[][]
  let counts: number[]
  let fail: boolean
  beforeEach(() => {
    calls = []
    counts = [60, 4, 12, 48, 1, 1]
    fail = false
    mocks.role.mockResolvedValue({
      organization: { id: 'org' },
      role: 'viewer',
    })
    const builder = (...args: unknown[]) => {
      const index = calls.length
      const log: Call[] = [{ method: 'start', args }]
      calls.push(log)
      const result: Record<string, unknown> = {}
      for (const method of [
        'ilike',
        'order',
        'range',
        'gt',
        'lt',
        'eq',
        'is',
        'not',
        'select',
        'gte',
        'lte',
        'limit',
      ])
        result[method] = (...values: unknown[]) => {
          log.push({ method, args: values })
          return result
        }
      // oxlint-disable-next-line unicorn/no-thenable -- El doble reproduce el builder awaitable de PostgREST.
      result.then = (resolve: (value: unknown) => void) =>
        resolve({
          count: counts[index] ?? 0,
          error: fail ? { message: 'error' } : null,
          data: index >= 6 ? [{ name: `grupo-${index}` }] : [],
        })
      return result
    }
    mocks.client.mockResolvedValue({ rpc: builder, from: builder })
  })
  it.each(Object.keys(marginOrders))(
    'deja los nulos al final con orden %s y cruza grupos en la página',
    async (orden) => {
      const search = marginSearchSchema.parse({ orden, q: '50%', pagina: '1' })
      const result = await getAnalysis('demo', 'margin', search)
      expect(result.error).toBe(false)
      expect(mocks.role).toHaveBeenCalledWith(
        'demo',
        'owner',
        'admin',
        'analyst',
        'viewer',
      )
      const [field, ascending] = marginOrders[search.orden]
      for (const log of calls.slice(6)) {
        expect(log.slice(1, 4)).toEqual([
          { method: 'ilike', args: ['name', '%50\\%%'] },
          { method: 'order', args: [field, { ascending, nullsFirst: false }] },
          {
            method: 'order',
            args: ['product_id', { ascending: true, nullsFirst: false }],
          },
        ])
      }
      expect(calls[6]!.slice(-2)).toEqual([
        { method: 'not', args: ['margin_pct', 'is', null] },
        { method: 'range', args: [0, 47] },
      ])
      expect(calls[7]!.slice(-2)).toEqual([
        { method: 'is', args: ['margin_pct', null] },
        { method: 'range', args: [0, 1] },
      ])
      if (!result.error)
        expect(result.rows.map((row) => row.name)).toEqual([
          'grupo-6',
          'grupo-7',
        ])
    },
  )
  it('ajusta una página excedida y consulta solamente el grupo sin costo', async () => {
    const result = await getAnalysis(
      'demo',
      'margin',
      marginSearchSchema.parse({ pagina: '999' }),
    )
    expect(result.error).toBe(false)
    if (!result.error) expect(result.page).toBe(2)
    expect(calls).toHaveLength(7)
    expect(calls[6]!.at(-1)).toEqual({ method: 'range', args: [2, 51] })
  })
  it('ordena ventas por caída e id de cliente, cuenta tres estados y pagina', async () => {
    await getAnalysis(
      'demo',
      'sales',
      salesSearchSchema.parse({ vista: 'clientes' }),
    )
    expect(calls[0]![0]!.args).toMatchObject([
      'metrics_by_customer',
      { p_organization_id: 'org' },
      { count: 'exact', head: true },
    ])
    expect(calls[6]!.slice(1)).toEqual([
      {
        method: 'order',
        args: ['delta', { ascending: true, nullsFirst: false }],
      },
      {
        method: 'order',
        args: ['customer_id', { ascending: true, nullsFirst: false }],
      },
      { method: 'range', args: [0, 49] },
    ])
    expect(calls[3]!.at(-1)).toEqual({ method: 'eq', args: ['delta', 0] })
  })
  it('no consulta filas cuando no hay resultados de margen y devuelve errores', async () => {
    counts = [0, 0, 0, 0, 1, 0]
    const result = await getAnalysis(
      'demo',
      'margin',
      marginSearchSchema.parse({}),
    )
    if (!result.error) expect(result.rows).toEqual([])
    expect(calls).toHaveLength(6)
    fail = true
    expect(
      (await getAnalysis('demo', 'sales', salesSearchSchema.parse({}))).error,
    ).toBe(true)
  })
})
