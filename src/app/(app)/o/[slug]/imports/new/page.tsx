import { requireRole } from '@/lib/server/auth'
import { uploadImport } from '@/features/imports/actions'
import { ActionForm } from '@/features/imports/components/action-form'
import { ImportSteps } from '@/features/imports/components/import-steps'
import { kindLabels } from '@/features/imports/queries'
import { AnalysisHeading } from '@/features/analysis/components'
export default async function NewImportPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { organization } = await requireRole(slug, 'owner', 'admin')
  return (
    <>
      <AnalysisHeading title="Nueva importación">
        Sube un archivo exportado de tu sistema; nada se guarda hasta que lo
        confirmes.
      </AnalysisHeading>
      <ImportSteps current={1} />
      <section className="card form-card">
        <ActionForm action={uploadImport} label="Subir archivo">
          <input type="hidden" name="organizationId" value={organization.id} />
          <div className="form-field">
            <label htmlFor="kind">Tipo de importación</label>
            <select id="kind" name="kind" required>
              {Object.entries(kindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="file">Archivo</label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".csv,.xlsx"
              aria-describedby="file-hint"
              required
            />
            <p id="file-hint" className="form-hint">
              CSV o XLSX de hasta 25 MiB.
            </p>
          </div>
        </ActionForm>
      </section>
    </>
  )
}
