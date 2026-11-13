import 'server-only'
import { z } from '@/lib/zod'
import { parseFile } from '@/lib/server/imports/parse'
import { validateRows, type RowOk } from '@/lib/server/imports/validate'
import { kindSchema, mappingSchema } from '@/features/imports/schemas'
import type { Json } from '@/lib/supabase/types'
import {
  audit,
  batches,
  checked,
  importId,
  type Client,
  type Job,
} from '../shared'

// Un folio debe viajar completo: cada RPC sustituye sus líneas de forma atómica.
export function salesBatches(rows: RowOk[]): RowOk[][] {
  const groups = new Map<string, RowOk[]>()
  for (const row of rows) {
    const ref = String(row.data.external_ref)
    const group = groups.get(ref)
    if (group) group.push(row)
    else groups.set(ref, [row])
  }
  const result: RowOk[][] = []
  let batch: RowOk[] = []
  for (const [ref, lines] of groups) {
    // shortcut: máximo 2000 líneas por folio, ampliar la RPC con staging si se necesitan folios mayores.
    if (lines.length > 2000)
      throw new Error('El folio ' + ref + ' supera el límite de 2000 líneas')
    const first = lines[0]!.data
    if (
      lines.some(({ data }) =>
        ['sold_on', 'customer_code', 'status', 'currency', 'tax'].some(
          (key) => (data[key] ?? '0.00') !== (first[key] ?? '0.00'),
        ),
      )
    )
      throw new Error('Cabecera inconsistente: ' + ref)
    if (batch.length + lines.length > 2000) {
      result.push(batch)
      batch = []
    }
    batch.push(...lines)
  }
  if (batch.length) result.push(batch)
  return result
}
export async function handleImport(db: Client, job: Job) {
  const id = importId(job)
  const organization_id = job.organization_id!
  const item = await checked(
    db
      .from('imports')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('id', id)
      .single(),
  )
  if (!item) throw new Error('Importación inexistente')
  if (
    !new RegExp(`^${organization_id}/[0-9a-f-]{36}-[A-Za-z0-9._-]+$`).test(
      item.storage_path,
    )
  )
    throw new Error('Ruta fuera de la organización')
  const organization = await checked(
    db
      .from('organizations')
      .select('currency')
      .eq('id', organization_id)
      .single(),
  )
  const file = await checked(
    db.storage.from('imports').download(item.storage_path),
  )
  if (!file || !organization)
    throw new Error('Archivo u organización inexistente')
  const source = await parseFile(
    Buffer.from(await file.arrayBuffer()),
    item.original_filename,
  )
  const kind = kindSchema.parse(item.kind)
  const mapping = mappingSchema.parse(item.column_mapping)
  const result = validateRows(source.rows, mapping, kind, organization)
  await checked(
    db
      .from('import_rows')
      .delete()
      .eq('organization_id', organization_id)
      .eq('import_id', id),
  )
  const errors = result.errors.map((row) => ({
    organization_id,
    import_id: id,
    row_number: row.rowNumber,
    raw: source.rows[row.rowNumber - 1]!,
    error: Object.values(row.fields).join('; '),
  }))
  const rowBatches =
    kind === 'sales' ? salesBatches(result.ok) : batches(result.ok, 2000)
  for (const batch of batches(errors))
    await checked(db.from('import_rows').insert(batch))
  let done = errors.length
  async function progress(count: number) {
    done += count
    await checked(
      db
        .from('jobs')
        .update({ progress: { done, total: source.rows.length } })
        .eq('organization_id', organization_id)
        .eq('id', job.id),
    )
  }
  for (const batch of rowBatches) {
    const rows = batch.map(({ data, rowNumber }) => {
      const payload: Record<string, unknown> = {
        ...data,
        row_number: rowNumber,
      }
      if (
        (kind === 'products' || kind === 'customers') &&
        (!mapping.active ||
          !source.rows[rowNumber - 1]![mapping.active]?.trim())
      )
        delete payload.active
      return payload
    })
    const applied = await checked(
      db.rpc(`apply_import_${kind}`, {
        p_organization_id: organization_id,
        p_import_id: id,
        p_rows: rows as Json,
      }),
    )
    const rejected = z
      .array(
        z.object({
          row_number: z.number().int().positive(),
          motivo: z.string(),
        }),
      )
      .parse(applied?.[0]?.rejected ?? [])
    const rejectedRows = rejected.map((row) => ({
      organization_id,
      import_id: id,
      row_number: row.row_number,
      raw: source.rows[row.row_number - 1]!,
      error: row.motivo,
    }))
    for (const chunk of batches(rejectedRows))
      await checked(db.from('import_rows').insert(chunk))
    errors.push(...rejectedRows)
    await progress(batch.length)
  }
  if (!result.ok.length) await progress(0)
  await checked(
    db
      .from('imports')
      .update({
        status: 'done',
        finished_at: new Date().toISOString(),
        ok_count: source.rows.length - errors.length,
        error_count: errors.length,
      })
      .eq('organization_id', organization_id)
      .eq('id', id),
  )
  await audit(db, job, 'imports.completed')
}
