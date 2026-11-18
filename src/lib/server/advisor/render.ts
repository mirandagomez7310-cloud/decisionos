import {
  formatMoney,
  formatPercent,
  formatPercentChange,
  formatPoints,
} from '@/lib/format'
import type { AdviceItem } from '../ai/schema'
import type { AdvisorFact } from './facts'

export const metricFormats = {
  net_sales: formatMoney,
  prev_net_sales: formatMoney,
  margin_base: formatMoney,
  gross_margin: formatMoney,
  inventory_value: formatMoney,
  stale_value: formatMoney,
  overdue_balance: formatMoney,
  open_balance: formatMoney,
  margin_pct: formatPercent,
  prev_margin_pct: formatPercent,
  coverage: formatPercent,
  stale_share_pct: formatPercent,
  top5_share_pct: formatPercent,
  overdue_pct: formatPercent,
  net_sales_change_pct: formatPercentChange,
  margin_pct_change_pts: formatPoints,
}

export type MetricField = keyof typeof metricFormats

export const marker = /\{\{([0-9a-f-]{36})\.([a-z0-9_]+)\}\}/g

export function readMetric(fact: AdvisorFact | undefined, field: string) {
  if (!Object.hasOwn(metricFormats, field)) return
  const key = field as MetricField
  const value = fact?.metric_snapshot[key]
  if (typeof value === 'number' && Number.isFinite(value))
    return { value, formatted: metricFormats[key](value) }
}

export function renderAdvice(item: AdviceItem, facts: AdvisorFact[]) {
  const metric_snapshot: Record<string, number> = {}
  const render = (text: string) =>
    text.replace(marker, (_, id: string, field: string) => {
      const metric = readMetric(
        facts.find((fact) => fact.id === id),
        field,
      )
      if (!metric) throw new Error('Marcador de asesoría inválido')
      metric_snapshot[`${id}.${field}`] = metric.value
      return metric.formatted
    })

  return { title: render(item.title), body: render(item.body), metric_snapshot }
}
