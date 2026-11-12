import { Button } from '@/components/ui/button'
import type { OrgRole } from '@/lib/supabase/types'
import { InvitationForm } from './invitation-form'
import { Revoke } from './revoke'
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
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Invitaciones</h2>
      <InvitationForm organizationId={organizationId} owner={owner} />
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
                <Button
                  disabled
                  title="El enlace solo está disponible al crear la invitación. Revoca y crea otra para obtener uno nuevo."
                >
                  Copiar enlace
                </Button>
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
