'use client'
import { useActionState } from 'react'
import { revokeInvitation } from '../actions'

export function Revoke({
  organizationId,
  invitationId,
}: {
  organizationId: string
  invitationId: string
}) {
  const [message, action, pending] = useActionState(async () => {
    try {
      const result = await revokeInvitation({ organizationId, invitationId })
      return result.error ?? ''
    } catch {
      return 'No pudimos conectar. Inténtalo de nuevo.'
    }
  }, '')
  return (
    <form className="revoke-form" action={action}>
      <button className="danger-link" type="submit" disabled={pending}>
        Revocar
      </button>
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}
