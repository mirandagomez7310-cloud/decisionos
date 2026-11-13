'use client'
import { useActionState, type ReactNode } from 'react'
export function ActionForm({
  action,
  children,
  label,
  disabled = false,
}: {
  action: (form: FormData) => Promise<{ error?: string; ok?: boolean }>
  children?: ReactNode
  label: string
  disabled?: boolean
}) {
  const [state, submit, pending] = useActionState(
    async (_: { error?: string; ok?: boolean }, form: FormData) => action(form),
    {},
  )
  return (
    <form action={submit} className="space-y-4">
      {children}
      {state.error && <p role="alert">{state.error}</p>}
      <button
        className="rounded border px-4 py-2 disabled:opacity-50"
        disabled={disabled || pending}
      >
        {pending ? 'Guardando…' : label}
      </button>
    </form>
  )
}
