import 'server-only'
import { env } from '@/env'
import { requireRole } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import type { Insight } from '@/lib/supabase/types'
import { sortRecommendations } from './advisor'
import { insightStates, insightStatuses, type InsightsSearch } from './schemas'

export const insightEditors = ['owner', 'admin', 'analyst'] as const
const insightFields =
  'id, module, kind, severity, title, body, period_start, period_end, rule_key, created_at'

export function countInsights(
  db: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  status: Insight['status'],
  source?: Insight['generated_by'],
) {
  const query = db
    .from('insights')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', status)
  return source ? query.eq('generated_by', source) : query
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
    .select(insightFields)
    .eq('organization_id', organization.id)
    .eq('generated_by', 'rule')
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
      countInsights(db, organization.id, value, 'rule'),
    ),
  ])
  if (rows.error || imports.error || counts.some(({ error }) => error))
    return { error: true } as const

  return {
    error: false as const,
    role,
    canChange: role !== 'viewer',
    hasData: !!imports.data?.length || counts.some(({ count }) => !!count),
    rows: rows.data ?? [],
    counts: counts.map(({ count }) => count ?? 0),
  }
}

export async function getAdvisor(slug: string) {
  const { organization } = await requireRole(slug, ...insightEditors, 'viewer')
  const db = await createClient()
  const [run, usage, rows, facts] = await Promise.all([
    db
      .from('advisor_runs')
      .select('id,status,cached,error')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.rpc('advisor_usage', { p_organization_id: organization.id }).single(),
    db
      .from('insights')
      .select('id,kind,status,title,body,evidence,created_at')
      .eq('organization_id', organization.id)
      .eq('generated_by', 'llm')
      .in('status', ['new', 'seen']),
    db
      .from('insights')
      .select('id')
      .eq('organization_id', organization.id)
      .eq('kind', 'fact')
      .in('status', ['new', 'seen'])
      .limit(1),
  ])
  if (run.error || usage.error || rows.error || facts.error)
    return { error: true } as const

  const recommendations = sortRecommendations(rows.data)
  const ids = [...new Set(recommendations.flatMap((row) => row.cites))]
  const citations = ids.length
    ? await db
        .from('insights')
        .select(`${insightFields},status`)
        .eq('organization_id', organization.id)
        .eq('kind', 'fact')
        .in('id', ids)
    : null
  if (citations?.error) return { error: true } as const

  return {
    error: false as const,
    enabled: !!env.AI_DRIVER,
    run: run.data,
    usage: usage.data,
    hasFacts: facts.data.length > 0,
    recommendations,
    citations: new Map(citations?.data.map((row) => [row.id, row])),
  }
}
