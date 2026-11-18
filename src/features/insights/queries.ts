import 'server-only'
import { requireRole } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import type { Insight } from '@/lib/supabase/types'
import { insightStates, insightStatuses, type InsightsSearch } from './schemas'
import { sortInsights } from './shared'

export const insightEditors = ['owner', 'admin', 'analyst'] as const

export function countInsights(
  db: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  status: Insight['status'],
) {
  return db
    .from('insights')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', status)
}

export async function getInsights(slug: string, search: InsightsSearch) {
  const { organization, role } = await requireRole(
    slug,
    ...insightEditors,
    'viewer',
  )
  const db = await createClient()
  const status = insightStatuses[insightStates.indexOf(search.estado)]!
  const query = db
    .from('insights')
    .select(
      'id, module, kind, severity, title, body, period_start, period_end, rule_key, created_at',
    )
    .eq('organization_id', organization.id)
    .eq('status', status)
  if (search.modulo !== 'todos') query.eq('module', search.modulo)

  const [rows, imports, ...counts] = await Promise.all([
    query.order('created_at', { ascending: false }).limit(100),
    db
      .from('imports')
      .select('id')
      .eq('organization_id', organization.id)
      .eq('status', 'done')
      .limit(1),
    ...insightStatuses.map((value) =>
      countInsights(db, organization.id, value),
    ),
  ])
  if (rows.error || imports.error || counts.some(({ error }) => error))
    return { error: true } as const

  return {
    error: false as const,
    role,
    canChange: role !== 'viewer',
    hasData: !!imports.data?.length || counts.some(({ count }) => !!count),
    rows: sortInsights(rows.data ?? []),
    counts: counts.map(({ count }) => count ?? 0),
  }
}
