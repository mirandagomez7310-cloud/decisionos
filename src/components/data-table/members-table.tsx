import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import type { OrgRole } from '@/lib/supabase/types'
import { MemberControls } from '@/features/members/components/member-controls'
export type MemberRow = {
  user_id: string
  email: string
  role: OrgRole
  created_at: string
  organization_id: string
  owner: boolean
}
const dateFormat = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Mexico_City',
})
export function MembersTable({ data }: { data: MemberRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Correo</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Fecha de alta</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((member) => (
          <TableRow key={member.user_id}>
            <TableCell>{member.email}</TableCell>
            <TableCell>{member.role}</TableCell>
            <TableCell>
              {dateFormat.format(new Date(member.created_at))}
            </TableCell>
            <TableCell>
              <MemberControls
                organizationId={member.organization_id}
                userId={member.user_id}
                email={member.email}
                role={member.role}
                owner={member.owner}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
