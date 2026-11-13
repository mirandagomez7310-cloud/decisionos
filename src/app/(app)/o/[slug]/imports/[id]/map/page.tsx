import { redirect } from 'next/navigation'
import { getImport, readImportFile } from '@/features/imports/queries'
import { saveMapping } from '@/features/imports/actions'
import { ActionForm } from '@/features/imports/components/action-form'
import { fields } from '@/lib/server/imports/kinds'
import { suggestMapping } from '@/lib/server/imports/mapping'
import { mappingSchema } from '@/features/imports/schemas'
export default async function MapImportPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const { organization, db, item, kind } = await getImport(slug, id, true)
  if (item.status !== 'pending') redirect(`/o/${slug}/imports/${id}`)
  const { headers, warnings } = await readImportFile(
    db,
    item.storage_path,
    item.original_filename,
  )
  const mapping = {
    ...suggestMapping(headers, kind),
    ...mappingSchema.parse(item.column_mapping),
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Asignar columnas</h1>
      <p>
        Paso 2 de 3. {item.original_filename}. Los campos con * son
        obligatorios.
      </p>
      {warnings.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
      <ActionForm action={saveMapping} label="Validar filas">
        <input type="hidden" name="organizationId" value={organization.id} />
        <input type="hidden" name="importId" value={id} />
        {fields[kind].map((field) => (
          <div key={field.name}>
            <label htmlFor={field.name}>
              {field.label}
              {field.required ? ' *' : ''}
            </label>
            <select
              className="block border p-2"
              id={field.name}
              name={`mapping.${field.name}`}
              required={field.required}
              defaultValue={mapping[field.name] ?? ''}
            >
              <option value="">Sin asignar</option>
              {headers.map((header) => (
                <option value={header} key={header}>
                  {header}
                </option>
              ))}
            </select>
          </div>
        ))}
      </ActionForm>
    </div>
  )
}
