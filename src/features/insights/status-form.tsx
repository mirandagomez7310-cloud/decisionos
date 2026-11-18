'use client'
import { useActionState } from 'react'
import { submitInsightStatus } from './actions'
import { adviceError } from './advisor'
import { submitAdvice } from './advisor-actions'
import type { InsightsSearch } from './schemas'

export function AdviceRequestForm({
  slug,
  busy,
  blocked,
}: {
  slug: string
  busy: boolean
  blocked: string | null
}) {
  const [state, action, pending] = useActionState(submitAdvice, null)
  const failed =
    state?.status === 'error' ||
    state?.status === 'no_facts' ||
    state?.status === 'disabled' ||
    state?.status === 'limit'
  return (
    <form action={action} className="grid justify-items-start gap-2">
      <input type="hidden" name="slug" value={slug} />
      <button
        className="action-button disabled:cursor-default disabled:opacity-60"
        disabled={pending || busy || !!blocked}
        aria-describedby={blocked ? 'advisor-blocked' : undefined}
      >
        Pedir recomendaciones
      </button>
      {blocked && <p id="advisor-blocked">{adviceError(blocked)}</p>}
      {!blocked && failed && <p role="alert">{adviceError(state.status)}</p>}
    </form>
  )
}

export function InsightStatusForm({
  slug,
  id,
  estado,
  href,
}: {
  slug: string
  id: string
  estado: InsightsSearch['estado']
  href: string
}) {
  const [state, action, pending] = useActionState(
    submitInsightStatus,
    { error: '' },
    href,
  )
  const active = estado === 'nuevos' || estado === 'vistos'
  return (
    <form action={action} className="insight-actions">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={id} />
      {estado === 'nuevos' && (
        <button name="status" value="seen" disabled={pending}>
          Marcar como visto
        </button>
      )}
      {active ? (
        <>
          <button name="status" value="done" disabled={pending}>
            Resuelto
          </button>
          <button name="status" value="dismissed" disabled={pending}>
            Descartar
          </button>
        </>
      ) : (
        <button name="status" value="new" disabled={pending}>
          Reabrir
        </button>
      )}
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  )
}
