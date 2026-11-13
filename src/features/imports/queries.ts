import 'server-only'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import { parseFile } from '@/lib/server/imports/parse'
import { kindSchema } from './schemas'
import { z } from '@/lib/zod'

export async function getImport(slug: string, id: string, edit = false) {
  const membership = await requireRole(
    slug,
    ...(edit
      ? (['owner', 'admin'] as const)
      : (['owner', 'admin', 'analyst', 'viewer'] as const)),
  )
  const db = await createClient()
  const { data: item, error } = await db
    .from('imports')
    .select('*')
    .eq('organization_id', membership.organization.id)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('No pudimos consultar la importación.')
  if (!item) notFound()
  return { ...membership, db, item, kind: kindSchema.parse(item.kind) }
}
export async function readImportFile(
  db: Awaited<ReturnType<typeof createClient>>,
  path: string,
  filename: string,
) {
  const { data, error } = await db.storage.from('imports').download(path)
  if (error || !data)
    throw new Error('No pudimos leer el archivo de importación.')
  return parseFile(Buffer.from(await data.arrayBuffer()), filename)
}
export function previewImport(
  item: Awaited<ReturnType<typeof getImport>>['item'],
) {
  return z
    .array(
      z.object({
        rowNumber: z.number().int().positive(),
        data: z.record(z.string(), z.unknown()),
      }),
    )
    .max(20)
    .parse(item.preview)
}
export const kindLabels = {
  products: 'Productos',
  customers: 'Clientes',
  sales: 'Ventas',
  inventory: 'Inventario',
  receivables: 'Cuentas por cobrar',
}
export const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  done: 'Completado',
  failed: 'Fallido',
  reverted: 'Revertido',
  queued: 'En cola',
  running: 'En ejecución',
}
