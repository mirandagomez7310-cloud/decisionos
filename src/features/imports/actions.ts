'use server'
import type { Json } from '@/lib/supabase/types'
import { redirect } from 'next/navigation'
import { refresh } from 'next/cache'
import { after } from 'next/server'
import { requireRoleForAction } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseFile } from '@/lib/server/imports/parse'
import { suggestMapping, validateMapping } from '@/lib/server/imports/mapping'
import { validateRows } from '@/lib/server/imports/validate'
import { fields } from '@/lib/server/imports/kinds'
import { runPendingJobs } from '@/lib/server/jobs'
import {
  importSchema,
  uploadSchema,
  kindSchema,
  mappingSchema,
  sanitizeFilename,
} from './schemas'

async function context(organizationId: string) {
  const auth = await requireRoleForAction(organizationId, 'owner', 'admin')
  if (!auth.ok)
    throw new Error('No tienes permiso para modificar importaciones.')
  const db = await createClient()
  const { data, error } = await db
    .from('organizations')
    .select('slug,currency')
    .eq('id', organizationId)
    .single()
  if (error || !data) throw new Error('No pudimos consultar la organización.')
  return { db, user: auth.data.user, organization: data }
}
async function audit(
  organizationId: string,
  userId: string,
  id: string,
  event: string,
) {
  const db = await createClient()
  const { error } = await db.from('audit_log').insert({
    organization_id: organizationId,
    actor_user_id: userId,
    actor_kind: 'user',
    action: `imports.${event}`,
    entity: 'imports',
    entity_id: id,
  })
  if (error)
    throw new Error(
      'No pudimos registrar la auditoría. Revisa el estado antes de reintentar.',
    )
}
const failure = (cause: unknown) => ({
  error:
    cause instanceof Error
      ? cause.message
      : 'No pudimos completar la operación.',
})

export async function uploadImport(form: FormData) {
  const parsed = uploadSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Solicitud inválida.' }
  let destination: string
  try {
    const { organizationId, kind, file } = parsed.data
    const { db, user, organization } = await context(organizationId)
    const parsedFile = await parseFile(
      Buffer.from(await file.arrayBuffer()),
      file.name,
    )
    const path = `${organizationId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`
    const { error: uploadError } = await db.storage
      .from('imports')
      .upload(path, file, {
        contentType: /\.csv$/i.test(file.name)
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    if (uploadError) throw new Error('No pudimos subir el archivo.')
    // El grant de inserción no permite status ni contadores; pending es el valor por defecto.
    const { data, error } = await db
      .from('imports')
      .insert({
        organization_id: organizationId,
        kind,
        storage_path: path,
        original_filename: file.name,
        column_mapping: suggestMapping(parsedFile.headers, kind),
        created_by: user.id,
      })
      .select('id')
      .single()
    if (error || !data) {
      await createAdminClient().storage.from('imports').remove([path])
      throw new Error('No pudimos guardar la importación.')
    }
    const { error: countError } = await createAdminClient()
      .from('imports')
      .update({ row_count: parsedFile.rows.length })
      .eq('organization_id', organizationId)
      .eq('id', data.id)
    await audit(organizationId, user.id, data.id, 'uploaded')
    if (countError)
      throw new Error('Archivo guardado; no pudimos guardar el total de filas.')
    destination = `/o/${organization.slug}/imports/${data.id}/map`
  } catch (cause) {
    return failure(cause)
  }
  redirect(destination)
}

export async function saveMapping(form: FormData) {
  const parsed = importSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Solicitud inválida.' }
  let destination: string
  try {
    const { organizationId, importId } = parsed.data
    const { db, user, organization } = await context(organizationId)
    const { data: item, error } = await db
      .from('imports')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('id', importId)
      .single()
    if (error || !item || item.status !== 'pending')
      throw new Error('Esta importación ya no admite cambios.')
    const kind = kindSchema.parse(item.kind)
    const mapping = mappingSchema.parse(
      Object.fromEntries(
        fields[kind].map((field) => [
          field.name,
          form.get(`mapping.${field.name}`) || null,
        ]),
      ),
    )
    const errors = validateMapping(mapping, kind)
    if (errors.length) return { error: errors.join('; ') }
    const admin = createAdminClient()
    const { data: file, error: downloadError } = await db.storage
      .from('imports')
      .download(item.storage_path)
    if (downloadError || !file)
      throw new Error('No pudimos descargar el archivo.')
    const source = await parseFile(
      Buffer.from(await file.arrayBuffer()),
      item.original_filename,
    )
    if (
      Object.values(mapping).some(
        (header) => header !== null && !source.headers.includes(header),
      )
    )
      return {
        error: 'El mapeo contiene cabeceras que no existen en el archivo.',
      }
    const result = validateRows(source.rows, mapping, kind, {
      currency: organization.currency,
    })
    // Invalidar contadores primero impide confirmar una validación incompleta.
    const { data: updated, error: updateError } = await admin
      .from('imports')
      .update({ column_mapping: mapping, ok_count: 0, error_count: 0 })
      .eq('organization_id', organizationId)
      .eq('id', importId)
      .eq('status', 'pending')
      .select('id')
      .single()
    if (updateError || !updated) throw new Error('No pudimos guardar el mapeo.')
    await audit(organizationId, user.id, importId, 'mapping_saved')
    const { error: deleteError } = await admin
      .from('import_rows')
      .delete()
      .eq('organization_id', organizationId)
      .eq('import_id', importId)
    if (deleteError)
      throw new Error('No pudimos sustituir la validación anterior.')
    for (let offset = 0; offset < result.errors.length; offset += 500) {
      const { error: rowsError } = await admin.from('import_rows').insert(
        result.errors.slice(offset, offset + 500).map((row) => ({
          organization_id: organizationId,
          import_id: importId,
          row_number: row.rowNumber,
          raw: source.rows[row.rowNumber - 1]!,
          error: Object.values(row.fields).join('; '),
        })),
      )
      if (rowsError)
        throw new Error('No pudimos guardar los errores de validación.')
    }
    const { error: countsError } = await admin
      .from('imports')
      .update({
        preview: result.ok.slice(0, 20).map(({ rowNumber, data }) => ({
          rowNumber,
          data: data as Record<string, Json>,
        })),
        row_count: result.summary.total,
        ok_count: result.summary.valid,
        error_count: result.summary.invalid,
      })
      .eq('organization_id', organizationId)
      .eq('id', importId)
      .eq('status', 'pending')
    if (countsError)
      throw new Error('No pudimos guardar el resumen de validación.')
    destination = `/o/${organization.slug}/imports/${importId}`
  } catch (cause) {
    return failure(cause)
  }
  redirect(destination)
}

export async function confirmImport(form: FormData) {
  return enqueue(form, false)
}
export async function revertImport(form: FormData) {
  return enqueue(form, true)
}
async function enqueue(form: FormData, revert: boolean) {
  const parsed = importSchema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Solicitud inválida.' }
  try {
    const { organizationId, importId } = parsed.data
    const { user } = await context(organizationId)
    const admin = createAdminClient()
    let query = admin
      .from('imports')
      .update({ status: 'processing' })
      .eq('organization_id', organizationId)
      .eq('id', importId)
      .eq('status', revert ? 'done' : 'pending')
    if (!revert) query = query.gt('ok_count', 0)
    const { data, error } = await query.select('id').single()
    if (error || !data)
      return { error: 'El estado actual no permite esta operación.' }
    const { error: jobError } = await admin.from('jobs').insert({
      organization_id: organizationId,
      kind: revert ? 'revert_import' : 'import',
      payload: { import_id: importId },
    })
    if (jobError) {
      await admin
        .from('imports')
        .update({ status: revert ? 'done' : 'pending' })
        .eq('organization_id', organizationId)
        .eq('id', importId)
        .eq('status', 'processing')
      throw new Error(
        'No pudimos crear el trabajo. Revisa el estado antes de reintentar.',
      )
    }
    after(runPendingJobs)
    await audit(
      organizationId,
      user.id,
      importId,
      revert ? 'revert_requested' : 'confirmed',
    )
    refresh()
    return { ok: true }
  } catch (cause) {
    refresh()
    return failure(cause)
  }
}
