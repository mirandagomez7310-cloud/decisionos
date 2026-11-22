import Link from 'next/link'
import type { Insight } from '@/lib/supabase/types'
import { evidenceHref } from './shared'

const severities = {
  critical: ['Crítico', 'risk-label risk-cell'],
  warning: ['Atención', 'risk-label warning-label'],
  info: ['Dato', 'insight-info'],
}

export function InsightSeverity({
  severity,
}: {
  severity: Insight['severity']
}) {
  const [label, className] = severities[severity]
  return <span className={className}>{label}</span>
}

export function InsightEvidence({
  slug,
  rule,
}: {
  slug: string
  rule: string | null
}) {
  const href = evidenceHref(slug, rule)
  return (
    href && (
      <Link className="underline" href={href}>
        Ver evidencia
      </Link>
    )
  )
}

export function DashboardInsights({
  slug,
  rows,
}: {
  slug: string
  rows: Pick<Insight, 'id' | 'title' | 'severity' | 'rule_key'>[]
}) {
  if (!rows.length) return null
  return (
    <section className="dashboard-explain">
      <h2>Diagnóstico</h2>
      <ol className="insight-list">
        {rows.map((row) => (
          <li key={row.id}>
            <InsightSeverity severity={row.severity} />
            <h3>{row.title}</h3>
            <InsightEvidence slug={slug} rule={row.rule_key} />
          </li>
        ))}
      </ol>
      <Link className="underline" href={`/o/${slug}/insights`}>
        Ver diagnóstico
      </Link>
    </section>
  )
}
