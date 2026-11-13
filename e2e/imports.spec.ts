import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { adminClient, email, login, slug } from './fixtures'

test('owner importa ventas, crea catálogo y revierte', async ({ page }) => {
  test.setTimeout(120000)
  const suffix = crypto.randomUUID().slice(0, 8)
  const sku = `PRODUCTO-${suffix}`
  const name = `Producto ${suffix}`
  const csv = readFileSync('e2e/fixtures/sales.csv', 'utf8')
    .replaceAll('PRODUCTO-NUEVO', sku)
    .replaceAll('Producto de prueba', name)
    .replaceAll('CLIENTE-NUEVO', `CLIENTE-${suffix}`)
    .replaceAll('FOLIO-A', `A-${suffix}`)
    .replaceAll('FOLIO-B', `B-${suffix}`)
  await login(page, email('owner'), `/o/${slug}/imports/new`)
  await page.getByLabel('Tipo de importación').selectOption('sales')
  await page.getByLabel('Archivo', { exact: true }).setInputFiles({
    name: 'ventas.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  })
  await page.getByRole('button', { name: 'Subir archivo' }).click()
  await expect(
    page.getByRole('heading', { name: 'Asignar columnas' }),
  ).toBeVisible()
  for (const field of [
    'external_ref',
    'sold_on',
    'customer_code',
    'customer_name',
    'product_sku',
    'product_name',
    'quantity',
    'unit_price',
  ])
    await page.locator(`[name="mapping.${field}"]`).selectOption(field)
  await page.getByRole('button', { name: 'Validar filas' }).click()
  await expect(
    page.getByText('cantidad no es un número', { exact: false }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Importar 29 filas válidas' }),
  ).toBeVisible()
  const detail = page.url()
  const importId = new URL(detail).pathname.split('/').pop()!
  await page.getByRole('button', { name: 'Importar 29 filas válidas' }).click()
  await expect(
    page.getByText('Estado: Completado', { exact: true }),
  ).toBeVisible({ timeout: 60000 })
  const db = adminClient()
  const { data: item, error } = await db
    .from('imports')
    .select('organization_id,ok_count,error_count')
    .eq('id', importId)
    .single()
  expect(error).toBeNull()
  expect(item).toMatchObject({ ok_count: 29, error_count: 1 })
  const org = item!.organization_id
  const sales = () =>
    db
      .from('sales')
      .select('id')
      .eq('organization_id', org)
      .eq('source_import_id', importId)
  expect((await sales()).data).toHaveLength(2)
  await page.goto(`/o/${slug}/catalog/products?q=${encodeURIComponent(sku)}`)
  await expect(page.getByText(name, { exact: true })).toBeVisible()
  await page.goto(detail)
  await page
    .getByRole('button', { name: 'Revertir (conserva productos y clientes)' })
    .click()
  await expect(
    page.getByText('Estado: Revertido', { exact: true }),
  ).toBeVisible({ timeout: 60000 })
  expect((await sales()).data).toEqual([])
})

test('viewer no ve Nueva importación', async ({ page }) => {
  await login(page, email('viewer'), `/o/${slug}/imports`)
  await expect(
    page.getByRole('heading', { name: 'Importaciones', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Nueva importación' }),
  ).toHaveCount(0)
})
