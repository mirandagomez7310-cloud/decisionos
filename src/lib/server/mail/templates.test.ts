import { expect, it } from 'vitest'
import { alertEmail } from './templates'

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
