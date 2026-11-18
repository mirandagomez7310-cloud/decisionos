import { formatDay, formatMonth } from '@/lib/format'
import type { Insight } from '@/lib/supabase/types'

const severityOrder = { critical: 0, warning: 1, info: 2 }

export function sortInsights<
  T extends Pick<Insight, 'severity' | 'created_at'>,
>(rows: T[]) {
  return rows.toSorted(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      Date.parse(b.created_at) - Date.parse(a.created_at),
  )
}

const margin = '/margin?periodo=prev_month&orden=margen_pct_asc'
const evidencePaths = new Map([
  ['sales_drop', '/sales?periodo=prev_month&orden=cambio_baja'],
  ['margin_drop', margin],
  ['negative_margin_products', margin],
  ['low_cost_coverage', margin],
  ['stale_inventory', '/inventory?filtro=sin_movimiento'],
  ['high_risk_customers', '/receivables?riesgo=alto'],
  ['receivables_concentration', '/receivables?orden=saldo'],
  ['overdue_share', '/receivables?orden=vencido'],
])

export function evidenceHref(slug: string, rule: string | null) {
  const path = rule && evidencePaths.get(rule)
  return path ? `/o/${slug}${path}` : undefined
}

export function formatInsightPeriod(from: string, to: string) {
  const nextDay = new Date(to + 'T00:00:00Z')
  nextDay.setUTCDate(nextDay.getUTCDate() + 1)
  return from.endsWith('-01') &&
    from.slice(0, 7) === to.slice(0, 7) &&
    nextDay.getUTCDate() === 1
    ? formatMonth(from)
    : `Corte al ${formatDay(to)}`
}
