import 'server-only'
import { escapeIlike, tablePage } from '@/features/analysis/shared'
import { requireRole } from '@/lib/server/auth'
import { todayInMexico } from '@/lib/server/metrics/period'
import { createClient } from '@/lib/supabase/server'
import { receivablesOrders, type ReceivablesSearch } from './schemas'

export async function getReceivables(slug: string, search: ReceivablesSearch) {
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
  const query = (risk: ReceivablesSearch['riesgo'], head = false) => {
    const builder = db.rpc('receivables_by_customer', args, {
      count: 'exact',
      head,
    })
    if (search.q) builder.ilike('name', `%${escapeIlike(search.q)}%`)
    if (risk !== 'todos') builder.eq('risk', risk)
    return builder
  }

  const [summaryResult, alto, medio, bajo] = await Promise.all([
    db.rpc('receivables_summary', args).single(),
    query('alto', true),
    query('medio', true),
    query('bajo', true),
  ])
  if (summaryResult.error || alto.error || medio.error || bajo.error)
    return { error: true as const }

  const summary = summaryResult.data
  const heading = { today, role }
  if (!summary.customer_count) {
    // El resumen agrega solo saldos abiertos.
    const { data, error } = await db
      .from('receivables')
      .select('id')
      .eq('organization_id', organization.id)
      .limit(1)
    if (error) return { error: true as const }
    return { ...heading, state: data.length ? 'paid' : 'empty' } as const
  }

  const high = alto.count ?? 0
  const medium = medio.count ?? 0
  const low = bajo.count ?? 0
  const counts = {
    alto: high,
    medio: medium,
    bajo: low,
    todos: high + medium + low,
  }
  const count = counts[search.riesgo]
  const { pages, page, start, end } = tablePage(count, search.pagina)
  const base = {
    ...heading,
    state: 'open' as const,
    summary,
    counts,
    count,
    pages,
    page,
  }
  if (!count) return { ...base, rows: [] }

  const [field, ascending] = receivablesOrders[search.orden]
  const result = await query(search.riesgo)
    .order(field, { ascending, nullsFirst: false })
    .order('customer_id', { ascending: true, nullsFirst: false })
    .range(start, end)
  if (result.error) return { error: true as const }
  return { ...base, rows: result.data }
}
