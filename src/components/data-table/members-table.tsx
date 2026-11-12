'use client'
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
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
const features = tableFeatures({})
const helper = createColumnHelper<typeof features, MemberRow>()
const columns = helper.columns([
  helper.accessor('email', { header: 'Correo' }),
  helper.accessor('role', { header: 'Rol' }),
  helper.accessor('created_at', {
    header: 'Fecha de alta',
    cell: ({ getValue }) =>
      new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
      }).format(new Date(getValue())),
  }),
  helper.display({
    id: 'actions',
    header: 'Acciones',
    cell: ({ row }) => (
      <MemberControls
        organizationId={row.original.organization_id}
        userId={row.original.user_id}
        email={row.original.email}
        role={row.original.role}
        owner={row.original.owner}
      />
    ),
  }),
])
export function MembersTable({ data }: { data: MemberRow[] }) {
  const table = useTable({
    data,
    columns,
    features,
    getRowId: (row) => row.user_id,
  })
  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHead key={header.id}>
                <table.FlexRender header={header} />
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getAllCells().map((cell) => (
              <TableCell key={cell.id}>
                <table.FlexRender cell={cell} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
