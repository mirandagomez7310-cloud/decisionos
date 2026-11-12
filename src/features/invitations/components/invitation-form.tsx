'use client'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RoleSelect } from '@/features/members/components/role-select'
import { createInvitation } from '../actions'
import { CopyLink } from './copy-link'

type State = { message?: string; emailError?: string; url?: string }
export function InvitationForm({
  organizationId,
  owner,
}: {
  organizationId: string
  owner: boolean
}) {
  const [state, action, pending] = useActionState(
    async (_: State, data: FormData): Promise<State> => {
      try {
        const result = await createInvitation({
          organizationId,
          email: data.get('email'),
          role: data.get('role'),
        })
        return {
          message: result.error,
          emailError: result.fieldErrors?.email?.[0],
          url: 'url' in result ? result.url : undefined,
        }
      } catch {
        return { message: 'No pudimos conectar. Inténtalo de nuevo.' }
      }
    },
    {},
  )
  return (
    <>
      <form className="flex flex-wrap items-end gap-3" action={action}>
        <div>
          <Label htmlFor="invitation-email">Correo de invitación</Label>
          <Input
            id="invitation-email"
            name="email"
            type="email"
            required
            aria-invalid={!!state.emailError}
            aria-describedby={
              state.emailError ? 'invitation-email-error' : undefined
            }
          />
          {state.emailError && (
            <p id="invitation-email-error" role="alert">
              {state.emailError}
            </p>
          )}
        </div>
        <RoleSelect
          name="role"
          defaultValue="viewer"
          owner={owner}
          label="Rol de invitación"
          disabled={pending}
        />
        <Button type="submit" disabled={pending}>
          Invitar
        </Button>
      </form>
      {state.message && <p role="alert">{state.message}</p>}
      {state.url && (
        <div className="space-y-2">
          <p>Guarda este enlace ahora. Solo se muestra una vez.</p>
          <output className="block break-all" aria-label="Enlace de invitación">
            {state.url}
          </output>
          <CopyLink url={state.url} />
        </div>
      )}
    </>
  )
}
