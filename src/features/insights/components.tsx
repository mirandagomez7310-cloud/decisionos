import Link from 'next/link'
import {
  Activity,
  ChartLine,
  Package,
  Percent,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Insight } from '@/lib/supabase/types'
import { evidenceHref } from './shared'

// Icono y color del módulo al que apunta la evidencia; mismos que en la navegación.
const modules: [string, LucideIcon, string][] = [
  ['/receivables', Wallet, '--m-receivables'],
  ['/inventory', Package, '--m-inventory'],
  ['/margin', Percent, '--m-margin'],
  ['/sales', ChartLine, '--m-sales'],
]
function moduleOf(href: string | undefined): [LucideIcon, string] {
  const pathname = href && new URL(href, 'http://local').pathname
  const found = pathname && modules.find(([path]) => pathname.endsWith(path))
  return found ? [found[1], found[2]] : [Activity, '--m-insights']
}

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
      <div className="section-head">
        <h2>Diagnóstico</h2>
        <Link className="underline" href={`/o/${slug}/insights`}>
          Ver diagnóstico
        </Link>
      </div>
      <ol className="insight-list">
        {rows.map((row) => {
          const [Icon, tone] = moduleOf(evidenceHref(slug, row.rule_key))
          return (
            <li key={row.id}>
              <div className="insight-card-head">
                <span
                  className="insight-tile"
                  aria-hidden="true"
                  style={{ '--tone': `var(${tone})` } as React.CSSProperties}
                >
                  <Icon />
                </span>
                <InsightSeverity severity={row.severity} />
              </div>
              <h3>{row.title}</h3>
              <InsightEvidence slug={slug} rule={row.rule_key} />
            </li>
          )
        })}
      </ol>
    </section>
  )
}
