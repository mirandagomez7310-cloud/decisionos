import 'server-only'
import { parseFile } from '@/lib/server/imports/parse'
import { validateRows, type RowOk } from '@/lib/server/imports/validate'
import { kindSchema, mappingSchema } from '@/features/imports/schemas'
import type { Database } from '@/lib/supabase/types'
import {
  audit,
  batches,
  checked,
  importId,
  type Client,
  type Job,
} from '../shared'

type Data = Record<string, unknown>
const text = (data: Data, key: string) => String(data[key])
export function sumMoney(values: string[]): string {
  const cents = values.reduce(
    (sum, value) => sum + BigInt(value.replace('.', '')),
    BigInt(0),
  )
  if (cents >= BigInt('100000000000000') || cents <= -BigInt('100000000000000'))
    throw new Error('Total fuera de numeric(14,2)')
  const absolute = cents < BigInt(0) ? -cents : cents
  return `${cents < BigInt(0) ? '-' : ''}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, '0')}`
}
export function groupSales(rows: RowOk[]) {
  const groups = new Map<string, RowOk[]>()
  for (const row of rows) {
    const ref = text(row.data, 'external_ref')
    const group = groups.get(ref)
    if (group) group.push(row)
    else groups.set(ref, [row])
  }
  return [...groups.values()].map((lines) => {
    const first = lines[0]!.data
    for (const { data } of lines) {
      if (
        ['sold_on', 'customer_code', 'status', 'currency', 'tax'].some(
          (key) => (data[key] ?? '0.00') !== (first[key] ?? '0.00'),
        )
      )
        throw new Error(`Cabecera inconsistente: ${first.external_ref}`)
    }
    const subtotal = sumMoney(lines.map((row) => text(row.data, 'line_total')))
    const tax = String(first.tax ?? '0.00')
    return {
      lines,
      header: {
        external_ref: text(first, 'external_ref'),
        sold_on: text(first, 'sold_on'),
        status: text(first, 'status'),
        currency: text(first, 'currency'),
        tax,
        subtotal,
        total: sumMoney([subtotal, tax]),
      },
    }
  })
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
  if (!item.storage_path.startsWith(`${organization_id}/`))
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
  const valid: RowOk[] = []
  const cache = new Map<string, string>()
  async function resolve(
    table: 'products' | 'customers',
    code: string,
    name?: unknown,
  ) {
    const key = `${table}:${code}`
    if (cache.has(key)) return cache.get(key)!
    const lookup = () =>
      table === 'products'
        ? db
            .from('products')
            .select('id')
            .eq('organization_id', organization_id)
            .eq('sku', code)
            .maybeSingle()
        : db
            .from('customers')
            .select('id')
            .eq('organization_id', organization_id)
            .eq('code', code)
            .maybeSingle()
    let row = await checked(lookup())
    if (!row && typeof name === 'string') {
      if (table === 'products')
        await checked(
          db
            .from('products')
            .upsert(
              { organization_id, sku: code, name },
              { onConflict: 'organization_id,sku', ignoreDuplicates: true },
            ),
        )
      else
        await checked(
          db
            .from('customers')
            .upsert(
              { organization_id, code, name },
              { onConflict: 'organization_id,code', ignoreDuplicates: true },
            ),
        )
      row = await checked(lookup())
    }
    if (row) cache.set(key, row.id)
    return row?.id
  }
  for (const row of result.ok) {
    const d = row.data
    let error = ''
    if (kind === 'sales' || kind === 'inventory') {
      d.product_id = await resolve(
        'products',
        text(d, 'product_sku'),
        d.product_name,
      )
      if (!d.product_id) error = 'Producto desconocido sin nombre'
    }
    if (kind === 'sales' || kind === 'receivables') {
      d.customer_id = await resolve(
        'customers',
        text(d, 'customer_code'),
        d.customer_name,
      )
      if (!d.customer_id) error = 'Cliente desconocido sin nombre'
    }
    if (error)
      errors.push({
        organization_id,
        import_id: id,
        row_number: row.rowNumber,
        raw: source.rows[row.rowNumber - 1]!,
        error,
      })
    else valid.push(row)
  }
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
  if (kind === 'sales') {
    for (const group of groupSales(valid)) {
      const sale = await checked(
        db
          .from('sales')
          .upsert(
            {
              ...group.header,
              organization_id,
              source_import_id: id,
              customer_id: text(group.lines[0]!.data, 'customer_id'),
            },
            { onConflict: 'organization_id,external_ref' },
          )
          .select('id')
          .single(),
      )
      if (!sale) throw new Error('No se obtuvo la venta guardada')
      // Si se corta entre borrado e inserción, el reintento reemplaza todas las líneas del folio.
      await checked(
        db
          .from('sale_lines')
          .delete()
          .eq('organization_id', organization_id)
          .eq('sale_id', sale.id),
      )
      for (const batch of batches(group.lines)) {
        await checked(
          db.from('sale_lines').insert(
            batch.map(({ data: d }) => ({
              organization_id,
              sale_id: sale.id,
              product_id: text(d, 'product_id'),
              quantity: text(d, 'quantity'),
              unit_price: text(d, 'unit_price'),
              unit_cost: d.unit_cost as string | undefined,
              discount: text(d, 'discount'),
              line_total: text(d, 'line_total'),
            })),
          ),
        )
        await progress(batch.length)
      }
    }
  } else {
    for (const batch of batches(valid)) {
      if (kind === 'products' || kind === 'customers') {
        const column = kind === 'products' ? 'sku' : 'code'
        const codes = batch.map((row) => text(row.data, column))
        const existing =
          kind === 'products'
            ? await checked(
                db
                  .from('products')
                  .select('*')
                  .eq('organization_id', organization_id)
                  .in('sku', codes),
              )
            : await checked(
                db
                  .from('customers')
                  .select('*')
                  .eq('organization_id', organization_id)
                  .in('code', codes),
              )
        const records = new Map<string, Data>(
          (existing ?? []).map((row) => [text(row, column), row]),
        )
        for (const { data: d, rowNumber } of batch) {
          const data = Object.fromEntries(
            Object.entries(d).filter(([, value]) => value != null),
          )
          // Una celda vac?a conserva el valor previo, incluido active.
          if (
            !mapping.active ||
            !source.rows[rowNumber - 1]![mapping.active]?.trim()
          )
            delete data.active
          const code = text(data, column)
          const defaults =
            kind === 'products'
              ? {
                  category: null,
                  unit: null,
                  standard_cost: null,
                  list_price: null,
                }
              : { segment: null, credit_limit: null, payment_terms_days: null }
          records.set(code, {
            ...defaults,
            active: true,
            ...records.get(code),
            ...data,
            organization_id,
          })
        }
        const payload = [...new Set(codes)].map((code) => records.get(code)!)
        if (kind === 'products')
          await checked(
            db
              .from('products')
              .upsert(
                payload as Database['public']['Tables']['products']['Insert'][],
                { onConflict: 'organization_id,sku' },
              ),
          )
        else
          await checked(
            db
              .from('customers')
              .upsert(
                payload as Database['public']['Tables']['customers']['Insert'][],
                { onConflict: 'organization_id,code' },
              ),
          )
      } else if (kind === 'inventory') {
        const records = new Map<
          string,
          Database['public']['Tables']['inventory_snapshots']['Insert']
        >()
        for (const { data: d } of batch) {
          const record = {
            organization_id,
            source_import_id: id,
            product_id: text(d, 'product_id'),
            snapshot_on: text(d, 'snapshot_on'),
            quantity: text(d, 'quantity'),
            unit_cost: d.unit_cost ?? null,
          }
          records.set(
            record.product_id + ':' + record.snapshot_on,
            record as unknown as Database['public']['Tables']['inventory_snapshots']['Insert'],
          )
        }
        await checked(
          db
            .from('inventory_snapshots')
            .upsert([...records.values()], {
              onConflict: 'organization_id,product_id,snapshot_on',
            }),
        )
      } else {
        const records = new Map<string, Data>()
        for (const { data: d } of batch) {
          const sale = d.sale_external_ref
            ? await checked(
                db
                  .from('sales')
                  .select('id')
                  .eq('organization_id', organization_id)
                  .eq('external_ref', text(d, 'sale_external_ref'))
                  .maybeSingle(),
              )
            : null
          records.set(text(d, 'external_ref'), {
            organization_id,
            source_import_id: id,
            external_ref: text(d, 'external_ref'),
            customer_id: text(d, 'customer_id'),
            sale_id: sale?.id ?? null,
            issued_on: text(d, 'issued_on'),
            due_on: text(d, 'due_on'),
            amount: text(d, 'amount'),
            paid_amount: text(d, 'paid_amount'),
          })
        }
        await checked(
          db
            .from('receivables')
            .upsert(
              [
                ...records.values(),
              ] as Database['public']['Tables']['receivables']['Insert'][],
              { onConflict: 'organization_id,external_ref' },
            ),
        )
      }
      await progress(batch.length)
    }
  }
  if (!valid.length) await progress(0)
  await checked(
    db
      .from('imports')
      .update({
        status: 'done',
        finished_at: new Date().toISOString(),
        ok_count: valid.length,
        error_count: errors.length,
      })
      .eq('organization_id', organization_id)
      .eq('id', id),
  )
  await audit(db, job, 'imports.completed')
}
