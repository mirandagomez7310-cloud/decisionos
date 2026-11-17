import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import Page from '@/app/(app)/o/[slug]/page'
const { query } = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('./queries', () => ({ getDashboard: query }))
vi.mock('./period-select', () => ({
  PeriodSelect: () => (
    <select aria-label="Periodo">
      <option>Mes en curso</option>
    </select>
  ),
}))
afterEach(cleanup)
const data = {
  error: false,
  kind: 'mtd',
  role: 'owner',
  hasSales: true,
  period: {
    from: '2026-11-01',
    to: '2026-11-13',
    prevFrom: '2026-10-01',
    prevTo: '2026-10-13',
  },
  summary: {
    net_sales: 100,
    prev_net_sales: 0,
    net_sales_change_pct: null,
    sales_count: 1,
    gross_margin: -10,
    margin_pct: -10,
    prev_margin_pct: null,
    margin_pct_change_pts: null,
    coverage: 83,
  },
  current: [],
  previous: [],
  products: [{ name: 'Producto con pérdida', delta: -10, margin_pct: -10 }],
  customers: [],
}
async function show(value: unknown) {
  query.mockResolvedValue(value)
  render(
    await Page({
      params: Promise.resolve({ slug: 'demo' }),
      searchParams: Promise.resolve({}),
    }),
  )
}
it('declara cobertura, ausencia de comparación y riesgo con texto', async () => {
  await show(data)
  expect(
    screen.getByText('Cobertura: 83 % del importe con costo'),
  ).toBeInTheDocument()
  expect(screen.getAllByText('Sin comparación')).toHaveLength(2)
  expect(screen.getByText('Riesgo')).toBeInTheDocument()
  expect(within(screen.getByRole('heading', { name: 'Margen bruto' }).closest('section')!).getByText('−$10.00')).toBeInTheDocument()
})
it('oculta el margen desconocido y ofrece cómo importar costos', async () => {
  await show({
    ...data,
    summary: { ...data.summary, coverage: null, margin_pct: null },
  })
  expect(within(screen.getByRole('heading', { name: 'Margen bruto' }).closest('section')!).queryByText('−$10.00')).not.toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Cómo importar costos' }),
  ).toHaveAttribute('href', '/o/demo/imports/new')
})
it('un periodo vacío con historial conserva cifras en cero', async () => {
  await show({
    ...data,
    summary: {
      ...data.summary,
      net_sales: 0,
      gross_margin: 0,
      sales_count: 0,
      coverage: null,
    },
  })
  expect(screen.getAllByText('$0.00')).toHaveLength(2)
  expect(screen.getAllByText('Sin ventas en el periodo')).toHaveLength(2)
  expect(screen.queryByText('Aún no hay datos')).not.toBeInTheDocument()
})
it.each(['owner', 'admin', 'analyst', 'viewer'])(
  'vacío respeta el rol %s',
  async (role) => {
    await show({ ...data, role, hasSales: false })
    expect(
      screen.getByRole('heading', { name: 'Aún no hay datos' }),
    ).toBeInTheDocument()
    expect(
      Boolean(screen.queryByRole('link', { name: 'Importar ventas' })),
    ).toBe(['owner', 'admin'].includes(role))
    if (role === 'analyst' || role === 'viewer')
      expect(screen.getByText(/Pide a un propietario/)).toBeInTheDocument()
  },
)
it('explica el error y conserva el periodo al reintentar', async () => {
  await show({ ...data, error: true })
  expect(screen.getByRole('alert')).toHaveTextContent(
    'No pudimos consultar el resumen',
  )
  expect(screen.getByRole('link', { name: 'Reintentar' })).toHaveAttribute(
    'href',
    '/o/demo?periodo=mtd',
  )
})
