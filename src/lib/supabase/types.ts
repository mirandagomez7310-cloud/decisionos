import type { Database as GeneratedDatabase } from './database.types'

export type { Json } from './database.types'
type PeriodArgs = {
  p_organization_id: string
  p_from: string
  p_to: string
  p_prev_from: string
  p_prev_to: string
}
export type MetricMovement = {
  name: string
  delta: number
  margin_pct: number | null
}
export type MetricSummary = {
  net_sales: number
  prev_net_sales: number
  net_sales_change_pct: number | null
  sales_count: number
  gross_margin: number
  margin_base: number
  margin_pct: number | null
  prev_margin_pct: number | null
  margin_pct_change_pts: number | null
  coverage: number | null
}
// Firmas de la migración de métricas; regenerar cuando se actualicen los tipos locales.
export type Database = GeneratedDatabase & {
  public: {
    Functions: {
      metrics_summary: { Args: PeriodArgs; Returns: MetricSummary[] }
      metrics_daily_sales: {
        Args: Omit<PeriodArgs, 'p_prev_from' | 'p_prev_to'>
        Returns: { day: string; net_sales: number }[]
      }
      metrics_by_product: {
        Args: PeriodArgs
        Returns: (MetricMovement & { product_id: string })[]
      }
      metrics_by_customer: {
        Args: PeriodArgs
        Returns: (MetricMovement & { customer_id: string })[]
      }
    }
  }
}
export type OrgRole = Database['public']['Enums']['org_role']
