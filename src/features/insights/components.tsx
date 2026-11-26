import Link from 'next/link'
import {
  Activity,
  ChartLine,
  CircleCheck,
  Compass,
  House,
  Lightbulb,
  Package,
  Percent,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Insight } from '@/lib/supabase/types'
import { evidenceHref } from './shared'

// Icono y color de cada módulo; los mismos que en la navegación.
const modules: Record<Insight['module'], [LucideIcon, string]> = {
  executive: [House, '--m-home'],
  sales: [ChartLine, '--m-sales'],
  profit: [Percent, '--m-margin'],
  inventory: [Package, '--m-inventory'],
  cash: [Wallet, '--m-receivables'],
}
const paths: [string, Insight['module']][] = [
  ['/receivables', 'cash'],
  ['/inventory', 'inventory'],
  ['/margin', 'profit'],
  ['/sales', 'sales'],
]
/** Módulo de un hallazgo que solo trae su regla: se deduce de la ruta de su evidencia. */
function moduleOfEvidence(href: string | undefined) {
  const pathname = href && new URL(href, 'http://local').pathname
  return pathname ? paths.find(([path]) => pathname.endsWith(path))?.[1] : undefined
}

export function InsightTile({ module }: { module?: Insight['module'] }) {
  const [Icon, tone] = module ? modules[module] : [Activity, '--m-insights']
  return (
    <span
      className="insight-tile"
      aria-hidden="true"
      style={{ '--tone': `var(${tone})` } as React.CSSProperties}
    >
      <Icon />
    </span>
  )
}

// Hecho, hipótesis y sugerencia nunca se confunden: cada uno con su icono y color.
const kinds: Record<Insight['kind'], [string, LucideIcon]> = {
  fact: ['Hecho', CircleCheck],
  hypothesis: ['Hipótesis', Lightbulb],
  suggestion: ['Sugerencia', Compass],
}
export function InsightKind({ kind }: { kind: Insight['kind'] }) {
  const [label, Icon] = kinds[kind]
  return (
    <span className="kind-tag" data-kind={kind}>
      <Icon aria-hidden="true" />
      {label}
    </span>
  )
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
        {rows.map((row) => (
          <li key={row.id}>
            <div className="insight-card-head">
              <InsightTile
                module={moduleOfEvidence(evidenceHref(slug, row.rule_key))}
              />
              <InsightSeverity severity={row.severity} />
            </div>
            <h3>{row.title}</h3>
            <InsightEvidence slug={slug} rule={row.rule_key} />
          </li>
        ))}
      </ol>
    </section>
  )
}
