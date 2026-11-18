'use client'
import { useActionState } from 'react'
import { submitInsightStatus } from './actions'
import type { InsightsSearch } from './schemas'

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
