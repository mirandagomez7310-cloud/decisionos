'use client'
import { useActionState, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { OrgRole } from '@/lib/supabase/types'
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
    return (
      <span className="member-locked">
        Solo un propietario puede editar este miembro.
      </span>
    )
  return (
    <div className="member-controls">
      <form action={action}>
        <RoleSelect
          name="role"
          defaultValue={role}
          owner={owner}
          label={'Rol de ' + email}
          disabled={pending}
        />
        <button
          className="secondary-button compact"
          disabled={pending}
          type="submit"
        >
          Guardar rol
        </button>
      </form>
      <button
        ref={trigger}
        className="danger-link"
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        Quitar miembro
      </button>
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
      {message && (
        <p className="member-message" role="alert">
          {message}
        </p>
      )}
    </div>
  )
}
