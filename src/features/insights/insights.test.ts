import { beforeEach, expect, it, vi } from 'vitest'
import { setInsightStatus } from './actions'
import { insightsSearchSchema } from './schemas'
import { evidenceHref, formatInsightPeriod, sortInsights } from './shared'

const { requireRole, createClient, rpc, revalidatePath } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock('@/lib/server/auth', () => ({ requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('next/cache', () => ({ revalidatePath }))

it('valida el estado y el módulo con valores por defecto', () => {
  expect(insightsSearchSchema.parse({})).toEqual({
    estado: 'nuevos',
    modulo: 'todos',
  })
  expect(
    insightsSearchSchema.parse({ estado: 'vistos', modulo: 'cash' }),
  ).toEqual({ estado: 'vistos', modulo: 'cash' })
  for (const input of [
    { estado: 'new' },
    { modulo: 'executive' },
    { estado: ['nuevos'] },
  ])
    expect(insightsSearchSchema.safeParse(input).success).toBe(false)
})

it('prioriza gravedad y fecha descendente', () => {
  const rows = [
    { severity: 'info', created_at: '2026-11-17' },
    { severity: 'critical', created_at: '2026-11-01' },
    { severity: 'warning', created_at: '2026-11-17' },
    { severity: 'critical', created_at: '2026-11-08' },
  ] as const
  expect(sortInsights([...rows])).toEqual([rows[3], rows[1], rows[2], rows[0]])
})

it.each([
  ['sales_drop', '/sales?periodo=prev_month&orden=cambio_baja'],
  ['margin_drop', '/margin?periodo=prev_month&orden=margen_pct_asc'],
  [
    'negative_margin_products',
    '/margin?periodo=prev_month&orden=margen_pct_asc',
  ],
  ['low_cost_coverage', '/margin?periodo=prev_month&orden=margen_pct_asc'],
  ['stale_inventory', '/inventory?filtro=sin_movimiento'],
  ['high_risk_customers', '/receivables?riesgo=alto'],
  ['receivables_concentration', '/receivables?orden=saldo'],
  ['overdue_share', '/receivables?orden=vencido'],
  ['toString', null],
])('resuelve la evidencia de %s', (rule, path) => {
  expect(evidenceHref('demo', rule)).toBe(path ? '/o/demo' + path : undefined)
})

it('distingue mes completo, corte parcial y cierre de otro mes', () => {
  expect(formatInsightPeriod('2024-02-01', '2024-02-29')).toBe('febrero 2024')
  expect(formatInsightPeriod('2024-02-01', '2024-02-17')).toBe(
    'Corte al 17 feb',
  )
  expect(formatInsightPeriod('2024-02-01', '2024-03-31')).toBe(
    'Corte al 31 mar',
  )
})

const id = '71d71116-41c7-4f84-85fb-228a21aef2e7'
function form(values: Partial<{ id: string; status: string }> = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries({
    slug: 'demo',
    id,
    status: 'done',
    ...values,
  }))
    data.set(key, value)
  return data
}

beforeEach(() => {
  vi.resetAllMocks()
  createClient.mockResolvedValue({ rpc })
  rpc.mockResolvedValue({ error: null })
})

it.each([{ id: 'incorrecto' }, { status: 'closed' }])(
  'rechaza cambios inválidos %o',
  async (values) => {
    expect(await setInsightStatus(form(values))).toEqual({
      error: 'Solicitud inválida.',
    })
    expect(requireRole).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  },
)

it('autoriza antes del RPC y revalida Diagnóstico e Inicio', async () => {
  expect(await setInsightStatus(form())).toEqual({ error: '' })
  expect(requireRole).toHaveBeenCalledWith('demo', 'owner', 'admin', 'analyst')
  expect(requireRole).toHaveBeenCalledBefore(rpc)
  expect(rpc).toHaveBeenCalledWith('set_insight_status', {
    p_insight_id: id,
    p_status: 'done',
  })
  expect(revalidatePath.mock.calls).toEqual([['/o/demo/insights'], ['/o/demo']])
})

it('devuelve el error del RPC como dato', async () => {
  rpc.mockResolvedValue({ error: { code: '42501' } })
  expect(await setInsightStatus(form())).toEqual({
    error: 'No pudimos cambiar el estado. Vuelve a intentarlo.',
  })
  expect(revalidatePath).not.toHaveBeenCalled()
})

it('sin permiso propaga la redirección de requireRole y no llama al RPC', async () => {
  requireRole.mockRejectedValue(new Error('NEXT_REDIRECT'))
  await expect(setInsightStatus(form())).rejects.toThrow('NEXT_REDIRECT')
  expect(rpc).not.toHaveBeenCalled()
})
