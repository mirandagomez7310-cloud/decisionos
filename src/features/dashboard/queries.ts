import 'server-only'
import { requireRole } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import {
  periodSchema,
  resolvePeriod,
  todayInMexico,
} from '@/lib/server/metrics/period'

export async function getDashboard(slug: string, rawPeriod?: string) {
  const membership = await requireRole(
    slug,
    'owner',
    'admin',
    'analyst',
    'viewer',
  )
  const parsed = periodSchema.safeParse(rawPeriod)
  const kind = parsed.success ? parsed.data : 'mtd'
  const period = resolvePeriod(kind, todayInMexico(new Date()))
  const db = await createClient()
  const args = {
    p_organization_id: membership.organization.id,
    p_from: period.from,
    p_to: period.to,
    p_prev_from: period.prevFrom,
    p_prev_to: period.prevTo,
  }
  const results = await Promise.all([
    db.rpc('metrics_summary', args).single(),
    db.rpc('metrics_daily_sales', {
      p_organization_id: args.p_organization_id,
      p_from: period.from,
      p_to: period.to,
    }),
    db.rpc('metrics_daily_sales', {
      p_organization_id: args.p_organization_id,
      p_from: period.prevFrom,
      p_to: period.prevTo,
    }),
    db
      .rpc('metrics_by_product', args)
      .gt('delta', 0)
      .order('delta', { ascending: false })
      .order('product_id')
      .limit(2),
    db
      .rpc('metrics_by_product', args)
      .lt('delta', 0)
      .order('delta')
      .order('product_id')
      .limit(2),
    db
      .rpc('metrics_by_customer', args)
      .gt('delta', 0)
      .order('delta', { ascending: false })
      .order('customer_id')
      .limit(2),
    db
      .rpc('metrics_by_customer', args)
      .lt('delta', 0)
      .order('delta')
      .order('customer_id')
      .limit(2),
    db
      .from('sales')
      .select('id', { head: true, count: 'exact' })
      .eq('organization_id', args.p_organization_id)
      .limit(1),
  ])
  const [
    summary,
    current,
    previous,
    productsUp,
    productsDown,
    customersUp,
    customersDown,
    sales,
  ] = results
  if (results.some((result) => result.error) || !summary.data)
    return { ...membership, kind, period, error: true as const }
  return {
    ...membership,
    kind,
    period,
    error: false as const,
    summary: summary.data,
    current: current.data ?? [],
    previous: previous.data ?? [],
    products: [...(productsUp.data ?? []), ...(productsDown.data ?? [])],
    customers: [...(customersUp.data ?? []), ...(customersDown.data ?? [])],
    hasSales: (sales.count ?? 0) > 0,
  }
}
