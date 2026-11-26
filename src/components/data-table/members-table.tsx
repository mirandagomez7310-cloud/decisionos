import { AnalysisTable } from '@/features/analysis/components'
import type { OrgRole } from '@/lib/supabase/types'
import { roleLabels } from '@/features/members/schemas'
import { MemberControls } from '@/features/members/components/member-controls'
import type { ReactNode } from 'react'
export type MemberRow = {
  user_id: string
  email: string
  role: OrgRole
  created_at: string
  organization_id: string
  owner: boolean
}
const dateFormat = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Mexico_City',
})
/** `head` lleva las celdas de cabecera (ordenables desde la página): Correo, Rol, Fecha de alta. */
export function MembersTable({
  data,
  head,
}: {
  data: MemberRow[]
  head: ReactNode
}) {
  return (
    <AnalysisTable label="Miembros de la organización" className="text-table">
      <thead>
        <tr>
          {head}
          <th scope="col">Acciones</th>
        </tr>
      </thead>
      <tbody>
        {data.map((member) => (
          <tr key={member.user_id}>
            <td className="member-email">{member.email}</td>
            <td>{roleLabels[member.role]}</td>
            <td>
              {dateFormat
                .format(new Date(member.created_at))
                .replaceAll('.', '')}
            </td>
            <td>
              <MemberControls
                organizationId={member.organization_id}
                userId={member.user_id}
                email={member.email}
                role={member.role}
                owner={member.owner}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </AnalysisTable>
  )
}
