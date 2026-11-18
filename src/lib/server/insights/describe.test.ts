import { expect, it } from 'vitest'
import type { InsightRule } from '@/lib/supabase/types'
import { describeInsight } from './describe'

const candidate = {
  module: 'sales',
  severity: 'warning',
  period_start: '2026-10-01',
  period_end: '2026-10-31',
} as const

it.each<{
  rule_key: string
  metric_snapshot: InsightRule['metric_snapshot']
  evidence?: InsightRule['evidence']
  title: string
  body: string
}>([
  {
    rule_key: 'sales_drop',
    metric_snapshot: {
      net_sales: '800',
      prev_net_sales: 1000,
      net_sales_change_pct: '-20',
    },
    title: 'Las ventas de octubre 2026 cayeron −20.0\u2009%',
    body: 'Venta neta de $800.00 frente a $1,000.00 el mes anterior.',
  },
  {
    rule_key: 'margin_drop',
    metric_snapshot: {
      margin_pct: '-10',
      prev_margin_pct: 0,
      margin_pct_change_pts: '-10',
    },
    title: 'El margen de octubre 2026 bajó −10.0 pts',
    body: 'Margen de −10.0\u2009% frente a 0.0\u2009% el mes anterior.',
  },
  {
    rule_key: 'negative_margin_products',
    metric_snapshot: { gross_margin: '-40' },
    evidence: { count: 2 },
    title: '2 productos vendieron con pérdida en octubre 2026',
    body: 'El peor margen bruto es −$40.00.',
  },
  {
    rule_key: 'negative_margin_products',
    metric_snapshot: { gross_margin: -40 },
    evidence: { count: '1' },
    title: '1 producto vendió con pérdida en octubre 2026',
    body: 'El peor margen bruto es −$40.00.',
  },
  {
    rule_key: 'low_cost_coverage',
    metric_snapshot: { coverage: 75, margin_base: '600', net_sales: 800 },
    title: 'Solo el 75.0\u2009% de las ventas de octubre 2026 tiene costo',
    body: 'El margen se calcula sobre $600.00 de $800.00. Importa los costos para completarlo.',
  },
  {
    rule_key: 'stale_inventory',
    metric_snapshot: {
      inventory_value: 100,
      stale_value: 30,
      stale_share_pct: '30',
    },
    title: '30.0\u2009% del inventario no se ha movido en 90 días',
    body: '$30.00 de $100.00 en existencias sin ventas.',
  },
  {
    rule_key: 'high_risk_customers',
    metric_snapshot: { overdue_balance: 200 },
    evidence: { count: '2' },
    title: '2 clientes con riesgo alto de cobranza',
    body: 'Tienen saldo a más de 90 días o superan su límite de crédito. El mayor vencido es $200.00.',
  },
  {
    rule_key: 'high_risk_customers',
    metric_snapshot: { overdue_balance: '200' },
    evidence: { count: 1 },
    title: '1 cliente con riesgo alto de cobranza',
    body: 'Tiene saldo a más de 90 días o supera su límite de crédito. El mayor vencido es $200.00.',
  },
  {
    rule_key: 'receivables_concentration',
    metric_snapshot: { top5_share_pct: 56.5, open_balance: 1150 },
    title: '5 clientes concentran el 56.5\u2009% de la cobranza',
    body: 'Saldo por cobrar total: $1,150.00.',
  },
  {
    rule_key: 'overdue_share',
    metric_snapshot: {
      overdue_pct: '39.1',
      overdue_balance: 450,
      open_balance: '1150',
    },
    title: 'El 39.1\u2009% de la cobranza está vencido',
    body: '$450.00 vencidos de $1,150.00 por cobrar.',
  },
])(
  'describe $rule_key · $title',
  ({ title, body, evidence = {}, ...fields }) => {
    expect(describeInsight({ ...candidate, ...fields, evidence })).toEqual({
      title,
      body,
    })
  },
)

it('rechaza una regla desconocida', () => {
  expect(() =>
    describeInsight({
      ...candidate,
      rule_key: 'otra',
      evidence: {},
      metric_snapshot: {},
    }),
  ).toThrow('Regla de insight desconocida: otra')
})
