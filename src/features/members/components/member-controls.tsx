'use client'
import { useActionState, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { OrgRole } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { changeMemberRole, removeMember } from '../actions'
import { RoleSelect } from './role-select'

const RemoveMemberDialog = dynamic(() => import('./remove-member-dialog'))

export function MemberControls({
  organizationId,
  userId,
  email,
  role,
  owner,
}: {
  organizationId: string
  userId: string
  email: string
  role: OrgRole
  owner: boolean
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const [message, action, pending] = useActionState(
    async (_: string, data: FormData) => {
      try {
        const result = await (data.get('intent') === 'remove'
          ? removeMember({ organizationId, userId })
          : changeMemberRole({
              organizationId,
              userId,
              role: data.get('role'),
            }))
        if (!result.error) setOpen(false)
        return result.error ?? 'Cambio guardado.'
      } catch {
        return 'No pudimos conectar. Inténtalo de nuevo.'
      }
    },
    '',
  )
  if (!owner && role === 'owner')
    return <span>Solo un propietario puede editar este miembro.</span>
  return (
    <div className="space-y-2">
      <form className="flex flex-wrap gap-2" action={action}>
        <RoleSelect
          name="role"
          defaultValue={role}
          owner={owner}
          label={'Rol de ' + email}
          disabled={pending}
        />
        <Button disabled={pending} type="submit">
          Guardar rol
        </Button>
      </form>
      <Button
        ref={trigger}
        type="button"
        variant="destructive"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        Quitar miembro
      </Button>
      {open && (
        <RemoveMemberDialog
          email={email}
          action={action}
          pending={pending}
          message={message}
          onOpenChange={setOpen}
          onCloseAutoFocus={() => trigger.current?.focus()}
        />
      )}
      {message && <p role="alert">{message}</p>}
    </div>
  )
}
