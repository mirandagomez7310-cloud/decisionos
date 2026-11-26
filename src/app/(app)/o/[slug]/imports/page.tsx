import Link from 'next/link'
import { requireRole } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import { kindLabels } from '@/features/imports/queries'
import { kindSchema } from '@/features/imports/schemas'
import { StatusChip } from '@/features/imports/components/status-chip'
import { AnalysisHeading, AnalysisTable } from '@/features/analysis/components'
import { EmptyImport } from '@/components/empty-import'
import { formatDateTime } from '@/lib/format'
import type { Database } from '@/lib/supabase/types'

const count = new Intl.NumberFormat('es-MX')

export default async function ImportsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { organization, role } = await requireRole(
    slug,
    'owner',
    'admin',
    'analyst',
    'viewer',
  )
  const db = await createClient()
  const rows: Database['public']['Tables']['imports']['Row'][] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from('imports')
      .select('*')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })
      .order('id')
      .range(offset, offset + 999)
    if (error) throw new Error('No pudimos consultar las importaciones.')
    rows.push(...data)
    if (data.length < 1000) break
  }
  const canImport = role === 'owner' || role === 'admin'
  return (
    <>
      <AnalysisHeading
        title="Importaciones"
        action={
          canImport &&
          rows.length > 0 && (
            <Link className="action-button" href={`/o/${slug}/imports/new`}>
              Nueva importación
            </Link>
          )
        }
      >
        Archivos CSV y Excel cargados a la organización
      </AnalysisHeading>
      {rows.length ? (
        <AnalysisTable
          label="Importaciones de la organización"
          className="text-table"
        >
          <thead>
            <tr>
              <th scope="col">Archivo</th>
              <th scope="col">Estado</th>
              <th scope="col" className="numeric">
                Filas válidas
              </th>
              <th scope="col" className="numeric">
                Filas con error
              </th>
              <th scope="col">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <Link
                    className="underline"
                    href={`/o/${slug}/imports/${row.id}`}
                  >
                    {row.original_filename}
                  </Link>
                  <span className="analysis-code">
                    {kindLabels[kindSchema.parse(row.kind)]}
                  </span>
                </th>
                <td>
                  <StatusChip status={row.status} />
                </td>
                <td className="numeric">{count.format(row.ok_count)}</td>
                <td
                  className={row.error_count ? 'numeric risk-cell' : 'numeric'}
                >
                  {count.format(row.error_count)}
                </td>
                <td>{formatDateTime(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </AnalysisTable>
      ) : (
        <EmptyImport
          slug={slug}
          role={role}
          title="Aún no hay importaciones"
          label="Nueva importación"
          subject="los datos"
        >
          Sube un CSV o Excel exportado de tu sistema: productos, clientes,
          ventas, inventario o cuentas por cobrar.
        </EmptyImport>
      )}
    </>
  )
}
