'use client'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
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
    <form action={action}>
      <Button type="submit" variant="outline" disabled={pending}>
        Revocar
      </Button>
      {message && <p role="alert">{message}</p>}
    </form>
  )
}
