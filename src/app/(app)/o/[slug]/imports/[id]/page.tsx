import Link from 'next/link'
import {
  getImport,
  kindLabels,
  previewImport,
} from '@/features/imports/queries'
import { confirmImport, revertImport } from '@/features/imports/actions'
import { ActionForm } from '@/features/imports/components/action-form'
import { ProcessingRefresh } from '@/features/imports/components/processing-refresh'
import { ImportSteps } from '@/features/imports/components/import-steps'
import { StatusChip } from '@/features/imports/components/status-chip'
import {
  AnalysisHeading,
  AnalysisSummary,
  AnalysisTable,
} from '@/features/analysis/components'
import { formatDateTime } from '@/lib/format'
import { fields } from '@/lib/server/imports/kinds'

const count = new Intl.NumberFormat('es-MX')
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
  const numeric = (type: string) =>
    ['number', 'money', 'quantity'].includes(type) ? 'numeric' : undefined
  return (
    <>
      <AnalysisHeading title="Detalle de importación">
        {item.original_filename} · {kindLabels[kind]} ·{' '}
        {formatDateTime(item.created_at)}
      </AnalysisHeading>
      {item.status === 'pending' && <ImportSteps current={3} />}
      <section className="card import-overview">
        <p className="import-status">
          Estado: <StatusChip status={item.status} />
        </p>
        <AnalysisSummary
          bar
          parts={[
            ['Válidas', item.ok_count, 'flat'],
            ['Con error', item.error_count, 'risk'],
          ]}
        >
          <span className="summary-chip-total">
            {count.format(item.row_count)} filas en el archivo
          </span>
        </AnalysisSummary>
        {canEdit && item.status === 'pending' && (
          <div className="import-actions">
            <ActionForm
              action={confirmImport}
              label={`Importar ${count.format(item.ok_count)} filas válidas`}
              disabled={item.ok_count === 0}
            >
              <input
                type="hidden"
                name="organizationId"
                value={organization.id}
              />
              <input type="hidden" name="importId" value={id} />
            </ActionForm>
            <Link
              className="secondary-button"
              href={`/o/${slug}/imports/${id}/map`}
            >
              Revisar mapeo
            </Link>
          </div>
        )}
        {canEdit && item.status === 'done' && (
          <div className="import-actions">
            <ActionForm
              action={revertImport}
              label="Revertir (conserva productos y clientes)"
              secondary
            >
              <input
                type="hidden"
                name="organizationId"
                value={organization.id}
              />
              <input type="hidden" name="importId" value={id} />
            </ActionForm>
          </div>
        )}
        {item.status === 'processing' && <ProcessingRefresh />}
      </section>
      {canEdit && (
        <>
          <section className="detail-section">
            <h2>Primeras 20 filas válidas</h2>
            {preview.length ? (
              <AnalysisTable
                label="Vista previa de filas válidas"
                className="preview-table"
              >
                <thead>
                  <tr>
                    <th scope="col">Fila</th>
                    {fields[kind].map((field) => (
                      <th
                        scope="col"
                        key={field.name}
                        className={numeric(field.type)}
                      >
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.rowNumber}>
                      <th scope="row">{count.format(row.rowNumber)}</th>
                      {fields[kind].map((field) => (
                        <td key={field.name} className={numeric(field.type)}>
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
              </AnalysisTable>
            ) : (
              <p className="detail-empty">No hay filas válidas que mostrar.</p>
            )}
          </section>
          <section className="detail-section">
            <h2>Errores por fila</h2>
            {errors.length ? (
              <ul className="card detail-list">
                {errors.map((row) => (
                  <li key={row.id}>{row.error}</li>
                ))}
              </ul>
            ) : (
              <p className="detail-empty">No hay errores registrados.</p>
            )}
          </section>
        </>
      )}
      <section className="detail-section">
        <h2>Trabajos</h2>
        {jobs.length ? (
          <ul className="card detail-list">
            {jobs.map((job) => (
              <li key={job.id}>
                <strong>{formatDateTime(job.created_at)}</strong>
                <StatusChip status={job.status} />
                {job.last_error && (
                  <p className="field-error" role="alert">
                    {job.last_error}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="detail-empty">No hay trabajos en cola.</p>
        )}
      </section>
    </>
  )
}
