import 'server-only'
import { escapeIlike } from './shared'
import { requireRole } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import type { MetricAnalysis } from '@/lib/supabase/types'
import { resolvePeriod, todayInMexico } from '@/lib/server/metrics/period'
import {
  marginOrders,
  salesOrders,
  type AnalysisScreen,
  type AnalysisSearch,
} from './schemas'

export async function getAnalysis(
  slug: string,
  screen: AnalysisScreen,
  search: AnalysisSearch,
) {
  const membership = await requireRole(
    slug,
    'owner',
    'admin',
    'analyst',
    'viewer',
  )
  const db = await createClient()
  const period = resolvePeriod(search.periodo, todayInMexico(new Date()))
  const args = {
    p_organization_id: membership.organization.id,
    p_from: period.from,
    p_to: period.to,
    p_prev_from: period.prevFrom,
    p_prev_to: period.prevTo,
  }
  const rpc =
    search.vista === 'productos' ? 'metrics_by_product' : 'metrics_by_customer'
  const id = search.vista === 'productos' ? 'product_id' : 'customer_id'
  const query = (head = false) => {
    const builder = db.rpc(rpc, args, { count: 'exact', head })
    return search.q
      ? builder.ilike('name', `%${escapeIlike(search.q)}%`)
      : builder
  }
  const [field, ascending] = { ...salesOrders, ...marginOrders }[search.orden]
  const ordered = () =>
    query()
      .order(field, { ascending, nullsFirst: false })
      .order(id, { ascending: true, nullsFirst: false })
  const [total, first, second, third, history, current] = await Promise.all([
    query(true),
    screen === 'sales'
      ? query(true).gt('delta', 0)
      : query(true).lt('gross_margin', 0),
    screen === 'sales'
      ? query(true).lt('delta', 0)
      : query(true).is('margin_pct', null),
    screen === 'sales'
      ? query(true).eq('delta', 0)
      : query(true).not('margin_pct', 'is', null),
    db
      .from('sales')
      .select('id', { head: true, count: 'exact' })
      .eq('organization_id', membership.organization.id)
      .limit(1),
    db
      .from('sales')
      .select('id', { head: true, count: 'exact' })
      .eq('organization_id', membership.organization.id)
      .eq('status', 'completed')
      .gte('sold_on', period.from)
      .lte('sold_on', period.to)
      .limit(1),
  ])
  const base = { ...membership, period }
  if (
    [total, first, second, third, history, current].some(
      (result) => result.error,
    )
  )
    return { ...base, error: true as const }
  const count = total.count ?? 0
  const pages = Math.max(1, Math.ceil(count / 50))
  const page = Math.min(search.pagina, pages)
  const start = (page - 1) * 50
  // Dos grupos permiten dejar los nulos al final sin alterar el orden elegido ni añadir SQL.
  const known = third.count ?? 0
  const results =
    screen === 'sales'
      ? [await ordered().range(start, start + 49)]
      : await Promise.all([
          ...(start < known
            ? [
                ordered()
                  .not('margin_pct', 'is', null)
                  .range(start, Math.min(start + 49, known - 1)),
              ]
            : []),
          ...(start + 50 > known && (second.count ?? 0) > 0
            ? [
                ordered()
                  .is('margin_pct', null)
                  .range(Math.max(0, start - known), start + 49 - known),
              ]
            : []),
        ])
  if (results.some((result) => result.error))
    return { ...base, error: true as const }
  const rows: (MetricAnalysis & {
    product_id?: string
    customer_id?: string
    sku?: string
    code?: string
  })[] = results.flatMap((result) => result.data ?? [])
  return {
    ...base,
    error: false as const,
    rows,
    count,
    page,
    pages,
    counts: [first.count ?? 0, second.count ?? 0, third.count ?? 0],
    hasSales: (history.count ?? 0) > 0,
    hasCurrentSales: (current.count ?? 0) > 0,
  }
}
