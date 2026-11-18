import {
  formatMoney,
  formatMonth,
  formatPercent,
  formatPoints,
} from '@/lib/format'
import type { InsightRule, Json } from '@/lib/supabase/types'

function numericField(data: InsightRule['evidence'], key: string) {
  const value = (data as Record<string, Json | undefined>)[key]
  if (typeof value !== 'number' && typeof value !== 'string')
    throw new Error(`Campo numérico inválido: ${key}`)
  return Number(value)
}

export function describeInsight(candidate: InsightRule): {
  title: string
  body: string
} {
  const metric = (key: string) => numericField(candidate.metric_snapshot, key)
  const money = (key: string) => formatMoney(metric(key))
  const percent = (key: string) => formatPercent(metric(key))
  const month = () => formatMonth(candidate.period_start)

  switch (candidate.rule_key) {
    case 'sales_drop':
      return {
        title: `Las ventas de ${month()} cayeron ${percent('net_sales_change_pct')}`,
        body: `Venta neta de ${money('net_sales')} frente a ${money('prev_net_sales')} el mes anterior.`,
      }
    case 'margin_drop':
      return {
        title: `El margen de ${month()} bajó ${formatPoints(metric('margin_pct_change_pts'))}`,
        body: `Margen de ${percent('margin_pct')} frente a ${percent('prev_margin_pct')} el mes anterior.`,
      }
    case 'negative_margin_products': {
      const count = numericField(candidate.evidence, 'count')
      return {
        title: `${count === 1 ? '1 producto vendió' : `${count} productos vendieron`} con pérdida en ${month()}`,
        body: `El peor margen bruto es ${money('gross_margin')}.`,
      }
    }
    case 'low_cost_coverage':
      return {
        title: `Solo el ${percent('coverage')} de las ventas de ${month()} tiene costo`,
        body: `El margen se calcula sobre ${money('margin_base')} de ${money('net_sales')}. Importa los costos para completarlo.`,
      }
    case 'stale_inventory':
      return {
        title: `${percent('stale_share_pct')} del inventario no se ha movido en 90 días`,
        body: `${money('stale_value')} de ${money('inventory_value')} en existencias sin ventas.`,
      }
    case 'high_risk_customers': {
      const count = numericField(candidate.evidence, 'count')
      return {
        title: `${count === 1 ? '1 cliente' : `${count} clientes`} con riesgo alto de cobranza`,
        body: `${count === 1 ? 'Tiene saldo a más de 90 días o supera' : 'Tienen saldo a más de 90 días o superan'} su límite de crédito. El mayor vencido es ${money('overdue_balance')}.`,
      }
    }
    case 'receivables_concentration':
      return {
        title: `5 clientes concentran el ${percent('top5_share_pct')} de la cobranza`,
        body: `Saldo por cobrar total: ${money('open_balance')}.`,
      }
    case 'overdue_share':
      return {
        title: `El ${percent('overdue_pct')} de la cobranza está vencido`,
        body: `${money('overdue_balance')} vencidos de ${money('open_balance')} por cobrar.`,
      }
    default:
      throw new Error(`Regla de insight desconocida: ${candidate.rule_key}`)
  }
}
