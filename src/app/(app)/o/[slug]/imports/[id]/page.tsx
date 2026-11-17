import Link from 'next/link'
import {
  getImport,
  previewImport,
  statusLabels,
} from '@/features/imports/queries'
import { confirmImport, revertImport } from '@/features/imports/actions'
import { ActionForm } from '@/features/imports/components/action-form'
import { ProcessingRefresh } from '@/features/imports/components/processing-refresh'
import { fields } from '@/lib/server/imports/kinds'
export default async function ImportPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const { organization, role, db, item, kind } = await getImport(slug, id)
  const canEdit = role === 'owner' || role === 'admin'
  const preview = canEdit && item.ok_count > 0 ? previewImport(item) : []
  const errors = []
  if (canEdit) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db
        .from('import_rows')
        .select('id,row_number,error')
        .eq('organization_id', organization.id)
        .eq('import_id', id)
        .not('error', 'is', null)
        .order('row_number')
        .order('id')
        .range(offset, offset + 999)
      if (error) throw new Error('No pudimos consultar los errores.')
      errors.push(...data)
      if (data.length < 1000) break
    }
  }
  const { data: jobs, error } = await db
    .from('jobs')
    .select('id,status,last_error,created_at')
    .eq('organization_id', organization.id)
    .eq('payload->>import_id', id)
    .order('created_at', { ascending: false })
  if (error) throw new Error('No pudimos consultar los trabajos.')
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Detalle de importación</h1>
      <p>Paso 3 de 3. {item.original_filename}</p>
      <p>Estado: {statusLabels[item.status]}</p>
      <dl className="flex flex-wrap gap-6">
        {(
          [
            ['Filas', item.row_count],
            ['Válidas', item.ok_count],
            ['Con error', item.error_count],
          ] as const
        ).map(([label, count]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{count.toLocaleString('es-MX')}</dd>
          </div>
        ))}
      </dl>
      {canEdit && item.status === 'pending' && (
        <>
          <Link className="underline" href={`/o/${slug}/imports/${id}/map`}>
            Revisar mapeo
          </Link>
          <ActionForm
            action={confirmImport}
            label={`Importar ${item.ok_count.toLocaleString('es-MX')} filas válidas`}
            disabled={item.ok_count === 0}
          >
            <input
              type="hidden"
              name="organizationId"
              value={organization.id}
            />
            <input type="hidden" name="importId" value={id} />
          </ActionForm>
        </>
      )}
      {canEdit && item.status === 'done' && (
        <ActionForm
          action={revertImport}
          label="Revertir (conserva productos y clientes)"
        >
          <input type="hidden" name="organizationId" value={organization.id} />
          <input type="hidden" name="importId" value={id} />
        </ActionForm>
      )}
      {item.status === 'processing' && <ProcessingRefresh />}
      {canEdit && (
        <>
          <h2 className="text-xl font-semibold">Primeras 20 filas válidas</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">
                Vista previa de filas válidas
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="p-2 text-right">
                    Fila
                  </th>
                  {fields[kind].map((field) => (
                    <th
                      className={
                        ['number', 'money', 'quantity'].includes(field.type)
                          ? 'p-2 text-right'
                          : 'p-2'
                      }
                      scope="col"
                      key={field.name}
                    >
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.rowNumber}>
                    <th scope="row" className="p-2 text-right">
                      {row.rowNumber.toLocaleString('es-MX')}
                    </th>
                    {fields[kind].map((field) => (
                      <td
                        className={
                          ['number', 'money', 'quantity'].includes(field.type)
                            ? 'p-2 text-right'
                            : 'p-2'
                        }
                        key={field.name}
                      >
                        {typeof row.data[field.name] === 'boolean'
                          ? row.data[field.name]
                            ? 'Sí'
                            : 'No'
                          : String(row.data[field.name] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2 className="text-xl font-semibold">Errores por fila</h2>
          {errors.length ? (
            <ul>
              {errors.map((row) => (
                <li key={row.id}>
                  Fila {row.row_number.toLocaleString('es-MX')}: {row.error}
                </li>
              ))}
            </ul>
          ) : (
            <p>No hay errores registrados.</p>
          )}
        </>
      )}
      <h2 className="text-xl font-semibold">Trabajos</h2>
      {jobs.length ? (
        <ul>
          {jobs.map((job) => (
            <li key={job.id}>
              {new Date(job.created_at).toLocaleString('es-MX')}:{' '}
              {statusLabels[job.status]}
              {job.last_error && <p role="alert">{job.last_error}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p>No hay trabajos en cola.</p>
      )}
    </div>
  )
}
