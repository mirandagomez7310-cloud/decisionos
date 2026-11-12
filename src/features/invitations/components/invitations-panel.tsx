'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { OrgRole } from '@/lib/supabase/types'
import { RoleSelect } from '@/features/members/components/role-select'
import { createInvitation, revokeInvitation } from '../actions'
type Invitation = {
  id: string
  email: string
  role: OrgRole
  expires_at: string
}
export function InvitationsPanel({
  organizationId,
  owner,
  invitations,
}: {
  organizationId: string
  owner: boolean
  invitations: Invitation[]
}) {
  const [role, setRole] = useState<OrgRole>('viewer')
  const [link, setLink] = useState<{ id: string; url: string } | null>(null)
  const [message, setMessage] = useState('')
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>()
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Invitaciones</h2>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={handleSubmit(async ({ email }) => {
          setMessage('')
          setLink(null)
          try {
            const result = await createInvitation({
              organizationId,
              email,
              role,
            })
            if (result.fieldErrors?.email?.[0])
              setError('email', { message: result.fieldErrors.email[0] })
            if (result.error) setMessage(result.error)
            if ('url' in result)
              setLink({ id: result.invitationId, url: result.url })
          } catch {
            setMessage('No pudimos conectar. Inténtalo de nuevo.')
          }
        })}
      >
        <div>
          <Label htmlFor="invitation-email">Correo de invitación</Label>
          <Input
            id="invitation-email"
            type="email"
            required
            {...register('email')}
            aria-invalid={!!errors.email}
            aria-describedby={
              errors.email ? 'invitation-email-error' : undefined
            }
          />
          {errors.email && (
            <p id="invitation-email-error" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>
        <RoleSelect
          value={role}
          onChange={setRole}
          owner={owner}
          label="Rol de invitación"
          disabled={isSubmitting}
        />
        <Button type="submit" disabled={isSubmitting}>
          Invitar
        </Button>
      </form>
      {message && <p role="alert">{message}</p>}
      {link && (
        <div className="space-y-2">
          <p>Guarda este enlace ahora. Solo se muestra una vez.</p>
          <output className="block break-all" aria-label="Enlace de invitación">
            {link.url}
          </output>
          <CopyLink url={link.url} />
        </div>
      )}
      {!invitations.length ? (
        <p>Aún no hay invitaciones</p>
      ) : (
        <>
          <p>
            Los enlaces anteriores no se pueden recuperar. Revoca y crea otra
            invitación si perdiste el enlace.
          </p>
          <ul className="space-y-4">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center gap-3 border-b pb-3"
              >
                <span className="break-all">{invitation.email}</span>
                <span>{invitation.role}</span>
                <span>
                  Caduca:{' '}
                  {new Intl.DateTimeFormat('es-MX', {
                    timeZone: 'America/Mexico_City',
                  }).format(new Date(invitation.expires_at))}
                </span>
                {link?.id === invitation.id ? (
                  <CopyLink url={link.url} />
                ) : (
                  <Button
                    disabled
                    title="El enlace solo está disponible al crear la invitación. Revoca y crea otra para obtener uno nuevo."
                  >
                    Copiar enlace
                  </Button>
                )}
                {(owner || invitation.role !== 'owner') && (
                  <Revoke
                    organizationId={organizationId}
                    invitationId={invitation.id}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
function CopyLink({ url }: { url: string }) {
  const [message, setMessage] = useState('')
  return (
    <>
      <Button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              new URL(url, window.location.origin).href,
            )
            setMessage('Enlace copiado.')
          } catch {
            setMessage(
              'No se pudo copiar. Selecciona el enlace y cópialo manualmente.',
            )
          }
        }}
      >
        Copiar enlace
      </Button>
      <output>{message}</output>
    </>
  )
}
function Revoke({
  organizationId,
  invitationId,
}: {
  organizationId: string
  invitationId: string
}) {
  const [message, setMessage] = useState('')
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm()
  return (
    <form
      onSubmit={handleSubmit(async () => {
        try {
          const result = await revokeInvitation({
            organizationId,
            invitationId,
          })
          setMessage(result.error ?? '')
        } catch {
          setMessage('No pudimos conectar. Inténtalo de nuevo.')
        }
      })}
    >
      <Button type="submit" variant="outline" disabled={isSubmitting}>
        Revocar
      </Button>
      {message && <p role="alert">{message}</p>}
    </form>
  )
}
