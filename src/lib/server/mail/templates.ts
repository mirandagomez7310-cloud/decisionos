import { sortInsights } from '@/features/insights/shared'
import {
  formatMoney,
  formatPercent,
  formatPercentChange,
  formatPeriod,
} from '@/lib/format'
import type { Database, Insight, MetricSummary } from '@/lib/supabase/types'

const entities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => entities[character]!)

export function alertEmail({
  organizationName,
  appUrl,
  slug,
  insights,
}: {
  organizationName: string
  appUrl: string
  slug: string
  insights: Pick<Insight, 'severity' | 'title' | 'body'>[]
}) {
  const summary =
    insights.length === 1
      ? '1 alerta nueva'
      : `${insights.length} alertas nuevas`
  const subject = `DecisionOS · ${summary} en ${organizationName.replace(/[\r\n]/g, ' ')}`
  const url = new URL(`/o/${encodeURIComponent(slug)}/insights`, appUrl).href
  const entries = insights.map(({ severity, title, body }) => ({
    heading: `${severity === 'critical' ? 'Crítico' : 'Atención'} · ${title}`,
    body,
  }))

  return {
    subject,
    text: [
      subject,
      ...entries.map(({ heading, body }) => `${heading}\n${body}`),
      `Ver diagnóstico: ${url}`,
    ].join('\n\n'),
    html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head><body><h1>${escapeHtml(subject)}</h1><ul>${entries.map(({ heading, body }) => `<li><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p></li>`).join('')}</ul><p><a href="${escapeHtml(url)}">Ver diagnóstico</a></p></body></html>`,
  }
}

type Metrics = Database['public']['Functions']

export function weeklyReportEmail({
  organizationName,
  appUrl,
  slug,
  from,
  to,
  sales,
  inventory,
  receivables,
  insights,
}: {
  organizationName: string
  appUrl: string
  slug: string
  from: string
  to: string
  sales: Pick<
    MetricSummary,
    'net_sales' | 'net_sales_change_pct' | 'margin_pct'
  > | null
  inventory: Pick<
    Metrics['inventory_summary']['Returns'][number],
    'stale_value' | 'stale_share_pct'
  > | null
  receivables: Pick<
    Metrics['receivables_summary']['Returns'][number],
    'overdue_balance' | 'overdue_pct'
  > | null
  insights: Pick<Insight, 'severity' | 'title' | 'body' | 'created_at'>[]
}) {
  const subject =
    `DecisionOS · Resumen semanal de ${organizationName} (${formatPeriod(from, to)})`.replace(
      /[\r\n\u2028\u2029]/g,
      ' ',
    )
  const summary: string[] = []
  if (sales) {
    const change =
      sales.net_sales_change_pct === null
        ? 'sin comparación disponible'
        : `${formatPercentChange(sales.net_sales_change_pct)} frente a la semana anterior`
    summary.push(`Ventas netas: ${formatMoney(sales.net_sales)} (${change})`)
    if (sales.margin_pct !== null)
      summary.push(`Margen bruto: ${formatPercent(sales.margin_pct)}`)
  }
  const share = (value: number | null) =>
    value === null
      ? 'porcentaje no disponible'
      : `${formatPercent(value)} del total`
  if (inventory)
    summary.push(
      `Inventario sin movimiento: ${formatMoney(inventory.stale_value)} (${share(inventory.stale_share_pct)})`,
    )
  if (receivables)
    summary.push(
      `Cobranza vencida: ${formatMoney(receivables.overdue_balance)} (${share(receivables.overdue_pct)})`,
    )

  const severityLabels = {
    info: 'Información',
    warning: 'Atención',
    critical: 'Crítico',
  }
  const findings = sortInsights(insights).map(({ severity, title, body }) => ({
    heading: `${severityLabels[severity]} · ${title}`,
    body,
  }))
  const empty = 'Sin hallazgos nuevos esta semana.'
  const path = `/o/${encodeURIComponent(slug)}`
  const links = [
    { label: 'Abrir DecisionOS', url: new URL(path, appUrl).href },
    { label: 'Ver diagnóstico', url: new URL(`${path}/insights`, appUrl).href },
  ]

  return {
    subject,
    text: [
      subject,
      ...(summary.length ? ['Cifras clave\n' + summary.join('\n')] : []),
      'Hallazgos',
      ...(findings.length
        ? findings.map(({ heading, body }) => `${heading}\n${body}`)
        : [empty]),
      ...links.map(({ label, url }) => `${label}: ${url}`),
    ].join('\n\n'),
    html: [
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head><body><h1>${escapeHtml(subject)}</h1>`,
      summary.length
        ? `<h2>Cifras clave</h2><ul>${summary.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
        : '',
      '<h2>Hallazgos</h2>',
      findings.length
        ? `<ul>${findings.map(({ heading, body }) => `<li><h3>${escapeHtml(heading)}</h3><p>${escapeHtml(body)}</p></li>`).join('')}</ul>`
        : `<p>${empty}</p>`,
      ...links.map(
        ({ label, url }) =>
          `<p><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></p>`,
      ),
      '</body></html>',
    ].join(''),
  }
}
