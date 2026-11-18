import 'server-only'

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sortInsights } from '@/features/insights/shared'
import type { Database, Insight } from '@/lib/supabase/types'
import { checked, workerClient, type Client } from '../jobs/shared'
import { metricFormats, type MetricField } from './render'

export type AdvisorFact = Pick<
  Insight,
  'id' | 'rule_key' | 'module' | 'severity' | 'title' | 'body'
> & {
  metric_snapshot: Partial<Record<MetricField, number | null>>
}

export async function loadAdvisorFacts(
  db: Client | SupabaseClient<Database>,
  organizationId: string,
): Promise<AdvisorFact[]> {
  const rows: Pick<
    Insight,
    | 'id'
    | 'rule_key'
    | 'module'
    | 'severity'
    | 'title'
    | 'body'
    | 'metric_snapshot'
    | 'created_at'
  >[] = []
  const client = workerClient(db)
  for (const severity of ['critical', 'warning', 'info'] as const) {
    const page = await checked(
      client
        .from('insights')
        .select(
          'id,rule_key,module,severity,title,body,metric_snapshot,created_at',
        )
        .eq('organization_id', organizationId)
        .eq('kind', 'fact')
        .in('status', ['new', 'seen'])
        .eq('severity', severity)
        .order('created_at', { ascending: false })
        .order('id')
        .limit(20 - rows.length),
    )
    if (!page) throw new Error('La consulta de hechos no devolvió datos')
    rows.push(...page)
    if (rows.length === 20) break
  }

  return sortInsights(rows).map(
    ({ id, rule_key, module, severity, title, body, metric_snapshot }) => {
      const snapshot: AdvisorFact['metric_snapshot'] = {}
      if (
        metric_snapshot &&
        typeof metric_snapshot === 'object' &&
        !Array.isArray(metric_snapshot)
      ) {
        for (const key of Object.keys(metricFormats) as MetricField[]) {
          const value = metric_snapshot[key]
          if (typeof value === 'number' && Number.isFinite(value))
            snapshot[key] = value
        }
      }
      return {
        id,
        rule_key,
        module,
        severity,
        title,
        body,
        metric_snapshot: snapshot,
      }
    },
  )
}

export function advisorInputHash(facts: AdvisorFact[]) {
  const canonical = facts
    .toSorted((a, b) => a.id.localeCompare(b.id))
    .map(({ id, metric_snapshot }) => ({
      id,
      metric_snapshot: Object.fromEntries(
        Object.entries(metric_snapshot).sort(([a], [b]) => a.localeCompare(b)),
      ),
    }))
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
}
