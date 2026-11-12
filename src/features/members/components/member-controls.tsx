'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { OrgRole } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { changeMemberRole, removeMember } from '../actions'
import { RoleSelect } from './role-select'
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
  const [selectedRole, setSelectedRole] = useState(role)
  const [message, setMessage] = useState('')
  const [open, setOpen] = useState(false)
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm()
  const removal = useForm()
  async function run(remove: boolean) {
    setMessage('')
    try {
      const result = await (remove
        ? removeMember({ organizationId, userId })
        : changeMemberRole({ organizationId, userId, role: selectedRole }))
      setMessage(result.error ?? 'Cambio guardado.')
      if (!result.error) setOpen(false)
    } catch {
      setMessage('No pudimos conectar. Inténtalo de nuevo.')
    }
  }
  if (!owner && role === 'owner')
    return <span>Solo un propietario puede editar este miembro.</span>
  return (
    <div className="space-y-2">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={handleSubmit(() => run(false))}
      >
        <RoleSelect
          value={selectedRole}
          onChange={setSelectedRole}
          owner={owner}
          label={'Rol de ' + email}
          disabled={isSubmitting || removal.formState.isSubmitting}
        />
        <Button
          disabled={isSubmitting || removal.formState.isSubmitting}
          type="submit"
        >
          Guardar rol
        </Button>
      </form>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" disabled={isSubmitting}>
            Quitar miembro
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Quitar miembro</DialogTitle>
          <DialogDescription>
            Se quitará el acceso de {email} a esta organización.
          </DialogDescription>
          <form onSubmit={removal.handleSubmit(() => run(true))}>
            <Button type="submit" disabled={removal.formState.isSubmitting}>
              Confirmar baja
            </Button>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={removal.formState.isSubmitting}
              >
                Cancelar
              </Button>
            </DialogClose>
          </form>
        </DialogContent>
      </Dialog>
      {message && <p role="alert">{message}</p>}
    </div>
  )
}
