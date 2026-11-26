import { requireRole } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import { AnalysisHeading, AnalysisTable } from '@/features/analysis/components'
import { formatDateTime } from '@/lib/format'

// shortcut: el actor se muestra como ID abreviado; resolver el correo cuando la auditoría tenga más uso.
const shortId = (id: string) => id.slice(0, 8)

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
      <AnalysisHeading title="Auditoría">
        Últimos 100 cambios en la organización, del más reciente al más antiguo
      </AnalysisHeading>
      {!data.length ? (
        <p>Aún no hay entradas de auditoría</p>
      ) : (
        <AnalysisTable label="Registro de auditoría" className="text-table">
          <thead>
            <tr>
              {['Fecha', 'Acción', 'Entidad', 'Actor'].map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.id}>
                <th scope="row">{formatDateTime(entry.created_at)}</th>
                <td>
                  <code>{entry.action}</code>
                </td>
                <td>
                  {entry.entity}
                  {entry.entity_id && (
                    <span className="analysis-code" title={entry.entity_id}>
                      {shortId(entry.entity_id)}
                    </span>
                  )}
                </td>
                <td>
                  {entry.actor_user_id ? (
                    <span title={entry.actor_user_id}>
                      Usuario {shortId(entry.actor_user_id)}
                    </span>
                  ) : (
                    'Sistema'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </AnalysisTable>
      )}
    </>
  )
}
