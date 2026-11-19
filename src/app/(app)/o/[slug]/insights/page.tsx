import Link from 'next/link'
import { EmptyImport } from '@/components/empty-import'
import { AnalysisHeading, QueryAlert } from '@/features/analysis/components'
import type { AnalysisPageProps } from '@/features/analysis/page'
import {
  InsightEvidence,
  InsightSeverity,
} from '@/features/insights/components'
import { getAdvisor, getInsights } from '@/features/insights/queries'
import { Recommendations } from '@/features/insights/recommendations'
import {
  insightModules,
  insightStates,
  insightStatuses,
  insightsSearchSchema,
  type InsightsSearch,
} from '@/features/insights/schemas'
import { formatInsightPeriod, sortInsights } from '@/features/insights/shared'
import { InsightStatusForm } from '@/features/insights/status-form'
import { requireRole } from '@/lib/server/auth'

const states = {
  nuevos: 'Nuevos',
  vistos: 'Vistos',
  resueltos: 'Resueltos',
  descartados: 'Descartados',
}
const modules = {
  todos: 'Todos',
  executive: 'Inicio',
  sales: 'Ventas',
  profit: 'Margen',
  inventory: 'Inventario',
  cash: 'Cobranza',
}
const kinds = {
  fact: 'Hecho',
  hypothesis: 'Hipótesis',
  suggestion: 'Sugerencia',
}

export default async function Page({
  params,
  searchParams,
}: AnalysisPageProps) {
  const { slug } = await params
  const path = `/o/${slug}/insights`
  const parsed = insightsSearchSchema.safeParse(await searchParams)
  const heading = (
    <AnalysisHeading title="Diagnóstico">
      Hallazgos calculados a partir de tus datos importados
    </AnalysisHeading>
  )
  if (!parsed.success) {
    await requireRole(slug, 'owner', 'admin', 'analyst', 'viewer')
    return (
      <>
        {heading}
        <QueryAlert href={path} label="Restablecer filtros">
          Filtros inválidos.
        </QueryAlert>
      </>
    )
  }

  const search = parsed.data
  const href = (changes: Partial<InsightsSearch> = {}) =>
    `${path}?${new URLSearchParams({ ...search, ...changes })}`
  const [data, advisor] = await Promise.all([
    getInsights(slug, search),
    getAdvisor(slug),
  ])
  if (data.error)
    return (
      <>
        {heading}
        <QueryAlert href={href()} label="Reintentar">
          No pudimos consultar el diagnóstico.
        </QueryAlert>
      </>
    )
  const recommendations = (
    <Recommendations
      slug={slug}
      href={href()}
      canChange={data.canChange}
      advisor={advisor}
    />
  )
  if (!data.hasData)
    return (
      <>
        {heading}
        {recommendations}
        <EmptyImport
          slug={slug}
          role={data.role}
          title="Aún no hay datos"
          label="Importar datos"
          subject="los datos"
        >
          Importa datos en CSV o Excel para generar hallazgos.
        </EmptyImport>
      </>
    )

  // Incluye las citas del filtro actual aunque queden fuera de los 100 más recientes.
  const rows = new Map(data.rows.map((row) => [row.id, row]))
  if (!advisor.error) {
    const status = insightStatuses[insightStates.indexOf(search.estado)]
    for (const fact of advisor.citations.values()) {
      if (
        fact.status === status &&
        (search.modulo === 'todos' || fact.module === search.modulo)
      )
        rows.set(fact.id, fact)
    }
  }

  return (
    <>
      {heading}
      {recommendations}
      <div className="analysis-controls">
        <nav className="analysis-switch" aria-label="Estado de los hallazgos">
          {insightStates.map((estado, index) => (
            <Link
              key={estado}
              href={href({ estado })}
              aria-current={estado === search.estado ? 'page' : undefined}
            >
              {states[estado]} ({data.counts[index]})
            </Link>
          ))}
        </nav>
        <nav className="analysis-switch" aria-label="Filtrar por módulo">
          {insightModules.map((modulo) => (
            <Link
              key={modulo}
              href={href({ modulo })}
              aria-current={modulo === search.modulo ? 'page' : undefined}
            >
              {modules[modulo]}
            </Link>
          ))}
        </nav>
      </div>
      {rows.size ? (
        <ol className="insight-list">
          {sortInsights([...rows.values()]).map((row) => (
            <li key={row.id}>
              <article id={`insight-${row.id}`}>
                <div className="insight-meta">
                  <InsightSeverity severity={row.severity} />
                  <span className="label-condensed">{modules[row.module]}</span>
                  <span className="label-condensed">{kinds[row.kind]}</span>
                  <span>
                    {formatInsightPeriod(row.period_start, row.period_end)}
                  </span>
                </div>
                <h2>{row.title}</h2>
                <p>{row.body}</p>
                <InsightEvidence slug={slug} rule={row.rule_key} />
                {data.canChange && (
                  <InsightStatusForm
                    slug={slug}
                    id={row.id}
                    estado={search.estado}
                    href={href()}
                  />
                )}
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <div>
          <p>Nada en {search.estado}</p>
          {search.estado === 'nuevos' && (
            <p>Los hallazgos se recalculan cada vez que importas datos.</p>
          )}
        </div>
      )}
    </>
  )
}
