import { requireRole } from '@/lib/server/auth'
import { uploadImport } from '@/features/imports/actions'
import { ActionForm } from '@/features/imports/components/action-form'
import { kindLabels } from '@/features/imports/queries'
export default async function NewImportPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { organization } = await requireRole(slug, 'owner', 'admin')
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nueva importación</h1>
      <p>Paso 1 de 3. Selecciona un archivo CSV o XLSX de hasta 25 MiB.</p>
      <ActionForm action={uploadImport} label="Subir archivo">
        <input type="hidden" name="organizationId" value={organization.id} />
        <div>
          <label htmlFor="kind">Tipo de importación</label>
          <select className="block border p-2" id="kind" name="kind" required>
            {Object.entries(kindLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="file">Archivo</label>
          <input
            className="block"
            id="file"
            name="file"
            type="file"
            accept=".csv,.xlsx"
            required
          />
        </div>
      </ActionForm>
    </div>
  )
}
