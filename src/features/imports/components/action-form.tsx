'use client'
import { useActionState, type ReactNode } from 'react'
export function ActionForm({
  action,
  children,
  label,
  disabled = false,
  secondary = false,
}: {
  action: (form: FormData) => Promise<{ error?: string; ok?: boolean }>
  children?: ReactNode
  label: string
  disabled?: boolean
  secondary?: boolean
}) {
  const [state, submit, pending] = useActionState(
    async (_: { error?: string; ok?: boolean }, form: FormData) => action(form),
    {},
  )
  return (
    <form action={submit} className="action-form">
      {children}
      {state.error && (
        <p className="field-error" role="alert">
          {state.error}
        </p>
      )}
      <button
        className={secondary ? 'secondary-button' : 'action-button'}
        disabled={disabled || pending}
      >
        {pending ? 'Guardando…' : label}
      </button>
    </form>
  )
}
