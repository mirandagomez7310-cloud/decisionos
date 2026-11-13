import { requireRole } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table'
export default async function AuditPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { organization } = await requireRole(slug, 'owner', 'admin')
  const db = await createClient()
  const { data, error } = await db
    .from('audit_log')
    .select('id,created_at,actor_user_id,action,entity,entity_id')
    .eq('organization_id', organization.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(100)
  if (error) throw new Error('No pudimos consultar la auditoría.')
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Auditoría</h1>
      {!data.length ? (
        <p>Aún no hay entradas de auditoría</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {['Fecha', 'Actor', 'Acción', 'Entidad'].map((label) => (
                <TableHead key={label}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  {new Intl.DateTimeFormat('es-MX', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'America/Mexico_City',
                  }).format(new Date(entry.created_at))}
                </TableCell>
                <TableCell>{entry.actor_user_id ?? 'Sistema'}</TableCell>
                <TableCell>{entry.action}</TableCell>
                <TableCell>
                  {entry.entity}: {entry.entity_id}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
