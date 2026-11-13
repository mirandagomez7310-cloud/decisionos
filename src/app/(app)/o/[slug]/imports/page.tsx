import Link from 'next/link'
import { requireRole } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import { kindLabels, statusLabels } from '@/features/imports/queries'
import { kindSchema } from '@/features/imports/schemas'
import type { Database } from '@/lib/supabase/types'
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
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Importaciones</h1>
      {(role === 'owner' || role === 'admin') && (
        <Link className="underline" href={`/o/${slug}/imports/new`}>
          Nueva importación
        </Link>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">
            Importaciones de la organización
          </caption>
          <thead>
            <tr>
              {[
                'Tipo',
                'Archivo',
                'Estado',
                'Filas válidas',
                'Filas con error',
                'Fecha',
                'Detalle',
              ].map((label) => (
                <th className="p-2" scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="p-2">
                  {kindLabels[kindSchema.parse(row.kind)]}
                </td>
                <td className="p-2">{row.original_filename}</td>
                <td className="p-2">{statusLabels[row.status]}</td>
                <td className="p-2">{row.ok_count.toLocaleString('es-MX')}</td>
                <td className="p-2">
                  {row.error_count.toLocaleString('es-MX')}
                </td>
                <td className="p-2">
                  {new Date(row.created_at).toLocaleString('es-MX')}
                </td>
                <td className="p-2">
                  <Link
                    className="underline"
                    href={`/o/${slug}/imports/${row.id}`}
                  >
                    Ver {row.original_filename}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>Aún no hay importaciones.</p>}
    </div>
  )
}
