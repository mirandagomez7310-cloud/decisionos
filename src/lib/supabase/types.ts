import type { Database as GeneratedDatabase, Json } from './database.types'

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
export type MetricAnalysis = MetricMovement & {
  net_sales: number
  prev_net_sales: number
  delta_pct: number | null
  gross_margin: number
  coverage: number | null
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
type AsOfArgs = { p_organization_id: string; p_as_of: string }
type InventorySummary = {
  snapshot_on: string | null
  inventory_value: number
  value_coverage: number | null
  cogs_90d: number
  days_on_hand: number | null
  turnover: number | null
  stale_value: number
  stale_share_pct: number | null
  stale_count: number
  product_count: number
}
type InventoryProduct = {
  product_id: string
  sku: string
  name: string
  quantity: number
  unit_cost: number | null
  inventory_value: number | null
  cogs_90d: number
  days_on_hand: number | null
  last_sold_on: string | null
  days_since_sale: number | null
  is_stale: boolean
}
type ReceivablesBalances = {
  open_balance: number
  overdue_balance: number
  current_balance: number
  d1_30: number
  d31_60: number
  d61_90: number
  d90_plus: number
}
type ReceivablesSummary = ReceivablesBalances & {
  overdue_pct: number | null
  customer_count: number
  top5_share_pct: number | null
}
type ReceivablesCustomer = ReceivablesBalances & {
  customer_id: string
  code: string
  name: string
  max_days_overdue: number
  credit_limit: number | null
  credit_used_pct: number | null
  share_pct: number
  risk: 'alto' | 'medio' | 'bajo'
}
export type InsightRule = {
  rule_key: string
  module: 'sales' | 'profit' | 'inventory' | 'cash'
  severity: 'info' | 'warning' | 'critical'
  period_start: string
  period_end: string
  evidence: NonNullable<Json>
  metric_snapshot: NonNullable<Json>
}

export type Insight = Omit<InsightRule, 'rule_key' | 'module'> & {
  id: string
  organization_id: string
  module: InsightRule['module'] | 'executive'
  kind: 'fact' | 'hypothesis' | 'suggestion'
  title: string
  body: string
  generated_by: 'rule' | 'llm'
  rule_key: string | null
  status: 'new' | 'seen' | 'dismissed' | 'done'
  created_at: string
  updated_at: string
}

type InsightDefaults = 'id' | 'rule_key' | 'status' | 'created_at' | 'updated_at'

// Firmas añadidas tras la generación local de tipos.
export type Database = GeneratedDatabase & {
  public: {
    Tables: {
      insights: {
        Row: Insight
        Insert: Omit<Insight, InsightDefaults> & Partial<Pick<Insight, InsightDefaults>>
        Update: Partial<Insight>
        Relationships: [{
          foreignKeyName: 'insights_organization_id_fkey'
          columns: ['organization_id']
          isOneToOne: false
          referencedRelation: 'organizations'
          referencedColumns: ['id']
        }]
      }
    }
    Functions: {
      evaluate_insight_rules: { Args: AsOfArgs; Returns: InsightRule[] }
      set_insight_status: {
        Args: { p_insight_id: string; p_status: Insight['status'] }
        Returns: Insight
      }
      enqueue_daily_insights: { Args: never; Returns: number }
      enqueue_insights: { Args: { p_organization_id: string }; Returns: boolean }
      inventory_summary: { Args: AsOfArgs; Returns: InventorySummary[] }
      inventory_by_product: { Args: AsOfArgs; Returns: InventoryProduct[] }
      receivables_summary: { Args: AsOfArgs; Returns: ReceivablesSummary[] }
      receivables_by_customer: { Args: AsOfArgs; Returns: ReceivablesCustomer[] }
      metrics_summary: { Args: PeriodArgs; Returns: MetricSummary[] }
      metrics_daily_sales: {
        Args: Omit<PeriodArgs, 'p_prev_from' | 'p_prev_to'>
        Returns: { day: string; net_sales: number }[]
      }
      metrics_by_product: {
        Args: PeriodArgs
        Returns: (MetricAnalysis & { product_id: string; sku: string })[]
      }
      metrics_by_customer: {
        Args: PeriodArgs
        Returns: (MetricAnalysis & { customer_id: string; code: string })[]
      }
    }
  }
}
export type OrgRole = Database['public']['Enums']['org_role']
