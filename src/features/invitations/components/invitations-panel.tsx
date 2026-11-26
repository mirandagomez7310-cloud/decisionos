import type { OrgRole } from '@/lib/supabase/types'
import { roleLabels } from '@/features/members/schemas'
import { InvitationForm } from './invitation-form'
import { Revoke } from './revoke'
type Invitation = {
  id: string
  email: string
  role: OrgRole
  expires_at: string
}
const dateFormat = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Mexico_City',
})
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
    <section className="detail-section">
      <h2>Invitaciones</h2>
      <div className="card form-card">
        <InvitationForm organizationId={organizationId} owner={owner} />
      </div>
      {!invitations.length ? (
        <p className="detail-empty">Aún no hay invitaciones</p>
      ) : (
        <>
          <p className="detail-empty">
            Los enlaces anteriores no se pueden recuperar. Revoca y crea otra
            invitación si perdiste el enlace.
          </p>
          <ul className="card detail-list">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                <strong className="member-email">{invitation.email}</strong>
                <span>{roleLabels[invitation.role]}</span>
                <span className="detail-muted">
                  Caduca el{' '}
                  {dateFormat
                    .format(new Date(invitation.expires_at))
                    .replaceAll('.', '')}
                </span>
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
