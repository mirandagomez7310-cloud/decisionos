import 'server-only'
import { audit, checked, importId, type Client, type Job } from '../shared'
export async function handleRevert(db: Client, job: Job) {
  const id = importId(job)
  const org = job.organization_id!
  for (;;) {
    const sales = await checked(
      db
        .from('sales')
        .select('id')
        .eq('organization_id', org)
        .eq('source_import_id', id)
        .limit(500),
    )
    if (!sales?.length) break
    const ids = sales.map((sale) => sale.id)
    await checked(
      db
        .from('sale_lines')
        .delete()
        .eq('organization_id', org)
        .in('sale_id', ids),
    )
    // Una cuenta de otra importación conserva su saldo aunque desaparezca la venta.
    await checked(
      db
        .from('receivables')
        .update({ sale_id: null })
        .eq('organization_id', org)
        .in('sale_id', ids),
    )
    await checked(
      db
        .from('sales')
        .delete()
        .eq('organization_id', org)
        .eq('source_import_id', id)
        .in('id', ids),
    )
  }
  for (const table of ['inventory_snapshots', 'receivables'] as const)
    await checked(
      db
        .from(table)
        .delete()
        .eq('organization_id', org)
        .eq('source_import_id', id),
    )
  await checked(
    db
      .from('import_rows')
      .delete()
      .eq('organization_id', org)
      .eq('import_id', id),
  )
  await checked(
    db
      .from('imports')
      .update({ status: 'reverted', finished_at: new Date().toISOString() })
      .eq('organization_id', org)
      .eq('id', id),
  )
  await audit(db, job, 'imports.reverted')
}
