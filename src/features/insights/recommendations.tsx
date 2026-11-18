import Link from 'next/link'
import { adviceError, priorityLabel, remainingAdvice } from './advisor'
import { AdvisorRefresh } from './advisor-refresh'
import type { getAdvisor } from './queries'
import { insightStates, insightStatuses } from './schemas'
import { AdviceRequestForm, InsightStatusForm } from './status-form'

export function Recommendations({
  slug,
  href,
  canChange,
  advisor,
}: {
  slug: string
  href: string
  canChange: boolean
  advisor: Awaited<ReturnType<typeof getAdvisor>>
}) {
  const path = `/o/${slug}/insights`
  if (advisor.error)
    return <p role="alert">No pudimos consultar las recomendaciones.</p>

  const { run, usage } = advisor
  const busy = run?.status === 'queued' || run?.status === 'running'
  const remaining = remainingAdvice(usage.used, usage.daily_limit)
  const blocked = !advisor.enabled
    ? 'disabled'
    : !advisor.hasFacts
      ? 'no_facts'
      : remaining === 0
        ? 'limit'
        : null

  return (
    <section
      aria-labelledby="advisor-heading"
      className="mb-6 grid gap-2 [&_:focus-visible]:outline-foreground"
    >
      <div className="insight-meta">
        <h2 id="advisor-heading" className="text-xl font-semibold">
          Recomendaciones
        </h2>
        <span className="border border-upright px-2 text-sm">
          Generado por IA
        </span>
      </div>
      <p>
        Hipótesis y sugerencias redactadas a partir de los hallazgos. Las cifras
        salen de tus datos
      </p>
      {canChange && (
        <>
          <AdviceRequestForm slug={slug} busy={busy} blocked={blocked} />
          <p>
            {remaining} de {usage.daily_limit} consultas disponibles hoy
          </p>
        </>
      )}
      {busy && <AdvisorRefresh key={run.id} />}
      {run?.cached && (
        <output>
          Tus hallazgos no han cambiado desde la última consulta; no se gastó
          ninguna consulta
        </output>
      )}
      {run?.status === 'failed' && <p role="alert">{adviceError(run.error)}</p>}
      {advisor.recommendations.length > 0 && (
        <ol className="insight-list">
          {advisor.recommendations.map((row) => (
            <li key={row.id}>
              <article id={`insight-${row.id}`}>
                <div className="insight-meta">
                  <span className="label-condensed">
                    {row.kind === 'hypothesis' ? 'Hipótesis' : 'Sugerencia'}
                  </span>
                  <span>{priorityLabel(row.priority)}</span>
                </div>
                <h3>{row.title}</h3>
                <p>{row.body}</p>
                {row.cites.some((id) => advisor.citations.has(id)) && (
                  <div>
                    <p>Se apoya en:</p>
                    <ul>
                      {row.cites.map((id) => {
                        const fact = advisor.citations.get(id)
                        if (!fact) return null
                        const estado =
                          insightStates[insightStatuses.indexOf(fact.status)]
                        return (
                          <li key={id}>
                            <Link
                              className="underline"
                              href={`${path}?estado=${estado}#insight-${id}`}
                            >
                              {fact.title}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
                {canChange && (
                  <InsightStatusForm
                    slug={slug}
                    id={row.id}
                    estado={row.status === 'seen' ? 'vistos' : 'nuevos'}
                    href={href}
                  />
                )}
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
