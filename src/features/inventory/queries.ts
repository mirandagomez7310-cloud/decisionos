import 'server-only'
import { escapeIlike, tablePage } from '@/features/analysis/shared'
import { requireRole } from '@/lib/server/auth'
import { todayInMexico } from '@/lib/server/metrics/period'
import { createClient } from '@/lib/supabase/server'
import { inventoryOrders, type InventorySearch } from './schemas'

export async function getInventory(slug: string, search: InventorySearch) {
  const { organization, role } = await requireRole(
    slug,
    'owner',
    'admin',
    'analyst',
    'viewer',
  )
  const db = await createClient()
  const today = todayInMexico(new Date())
  const args = { p_organization_id: organization.id, p_as_of: today }
  const query = (head = false) => {
    const builder = db.rpc('inventory_by_product', args, {
      count: 'exact',
      head,
    })
    if (search.q) builder.ilike('name', `%${escapeIlike(search.q)}%`)
    if (search.filtro === 'sin_movimiento') builder.eq('is_stale', true)
    return builder
  }

  const [summaryResult, total] = await Promise.all([
    db.rpc('inventory_summary', args).single(),
    query(true),
  ])
  if (summaryResult.error || total.error) return { error: true as const }

  const summary = summaryResult.data
  const count = total.count ?? 0
  const { pages, page, start, end } = tablePage(count, search.pagina)
  const base = {
    error: false as const,
    summary,
    today,
    role,
    count,
    pages,
    page,
  }
  if (!count) return { ...base, rows: [] }

  const [field, ascending] = inventoryOrders[search.orden]
  const result = await query()
    .order(field, { ascending, nullsFirst: search.orden === 'sin_venta' })
    .order('product_id', { ascending: true, nullsFirst: false })
    .range(start, end)
  if (result.error) return { error: true as const }
  return { ...base, rows: result.data }
}
