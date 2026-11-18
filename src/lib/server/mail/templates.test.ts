import { expect, it } from 'vitest'
import { alertEmail, weeklyReportEmail } from './templates'

const organization = {
  organizationName: `A & B\n<"' >`,
  appUrl: 'https://decisionos.example/',
  slug: 'empresa',
}
const critical = {
  severity: 'critical',
  title: '<script>',
  body: 'A & B',
} as const

it('usa singular, escapa HTML y enlaza al diagnóstico absoluto', () => {
  const { subject, text, html } = alertEmail({
    ...organization,
    insights: [critical],
  })
  const url = 'https://decisionos.example/o/empresa/insights'
  expect(subject).toBe(`DecisionOS · 1 alerta nueva en A & B <"' >`)
  expect(text).toContain('Crítico · <script>\nA & B')
  expect(text).toContain(url)
  expect(html).not.toContain('<script>')
  expect(html).toContain('A &amp; B &lt;&quot;&#39; &gt;')
  expect(html).toContain('Crítico · &lt;script&gt;')
  expect(html).toContain(`href="${url}"`)
})

it('usa plural e incluye ambas gravedades', () => {
  const { subject, text } = alertEmail({
    ...organization,
    insights: [
      critical,
      { severity: 'warning', title: 'Saldo', body: 'Pendiente' },
    ],
  })
  expect(subject).toContain('2 alertas nuevas')
  expect(text).toContain('Atención · Saldo\nPendiente')
  expect(text).toContain('Crítico')
})

const emptyReport = {
  ...organization,
  from: '2026-11-09',
  to: '2026-11-15',
  sales: null,
  inventory: null,
  receivables: null,
  insights: [],
}

it('omite cifras sin datos, indica que no hay hallazgos y enlaza las dos páginas', () => {
  const { subject, text, html } = weeklyReportEmail(emptyReport)
  expect(subject).toBe(
    `DecisionOS · Resumen semanal de A & B <"' > (9–15 nov 2026)`,
  )
  expect(html).toContain('A &amp; B &lt;&quot;&#39; &gt;')
  for (const body of [text, html]) {
    expect(body).toContain('Sin hallazgos nuevos esta semana.')
    expect(body).not.toMatch(
      /Cifras clave|Ventas netas|Inventario sin movimiento|Cobranza vencida/,
    )
  }
  expect(html).toContain('href="https://decisionos.example/o/empresa"')
  expect(html).toContain('href="https://decisionos.example/o/empresa/insights"')
  expect(text).toContain('https://decisionos.example/o/empresa/insights')
})

it.each([
  [
    { sales: { net_sales: 1200, net_sales_change_pct: 12, margin_pct: 40 } },
    [
      'Ventas netas: $1,200.00 (+12.0\u2009% frente a la semana anterior)',
      'Margen bruto: 40.0\u2009%',
    ],
    /Inventario|Cobranza/,
  ],
  [
    { inventory: { stale_value: 400, stale_share_pct: 20 } },
    ['Inventario sin movimiento: $400.00 (20.0\u2009% del total)'],
    /Ventas|Cobranza/,
  ],
  [
    { receivables: { overdue_balance: 100, overdue_pct: 50 } },
    ['Cobranza vencida: $100.00 (50.0\u2009% del total)'],
    /Ventas|Inventario/,
  ],
] as const)(
  'muestra únicamente las cifras de la fuente disponible',
  (metrics, lines, excluded) => {
    const { text, html } = weeklyReportEmail({ ...emptyReport, ...metrics })
    for (const body of [text, html]) {
      for (const line of lines) expect(body).toContain(line)
      expect(body).not.toMatch(excluded)
    }
  },
)

it('omite el margen sin costos y ordena y escapa los hallazgos de cualquier gravedad', () => {
  const { text, html } = weeklyReportEmail({
    ...emptyReport,
    sales: { net_sales: 0, net_sales_change_pct: null, margin_pct: null },
    insights: [
      {
        severity: 'info',
        title: 'Dato',
        body: 'Detalle',
        created_at: '2026-11-14',
      },
      {
        severity: 'warning',
        title: 'Saldo',
        body: 'Pendiente',
        created_at: '2026-11-14',
      },
      { ...critical, created_at: '2026-11-10' },
    ],
  })
  expect(text).toContain('sin comparación disponible')
  expect(text).not.toContain('Margen bruto')
  expect(text).toMatch(
    /Crítico · <script>[\s\S]+Atención · Saldo[\s\S]+Información · Dato/,
  )
  expect(html).toContain('Crítico · &lt;script&gt;')
  expect(html).toContain('A &amp; B')
  expect(html).not.toContain('<script>')
})
