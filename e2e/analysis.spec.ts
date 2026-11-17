import { expect } from '@playwright/test'
import { test, email, login, slug } from './fixtures'
import { resolvePeriod, todayInMexico } from '../src/lib/server/metrics/period'

test('owner analiza margen, cambio exacto y búsqueda literal después de importar', async ({
  page,
  dashboardOwner: { orgSlug, userEmail },
}) => {
  test.setTimeout(120000)
  await page.context().clearCookies()
  await login(page, userEmail, `/o/${orgSlug}/imports/new`)
  const period = resolvePeriod('mtd', todayInMexico(new Date()))
  const fields = [
    'external_ref',
    'sold_on',
    'customer_code',
    'customer_name',
    'product_sku',
    'product_name',
    'quantity',
    'unit_price',
    'unit_cost',
    'discount',
  ]
  const rows = [period.to, period.prevTo].flatMap((date, periodIndex) => [
    [
      `V-${periodIndex}-1`,
      date,
      'C1',
      'Cliente análisis',
      'P1',
      'Producto pérdida',
      '2',
      periodIndex === 0 ? '100.25' : '80.10',
      '120.50',
      '0.20',
    ],
    [
      `V-${periodIndex}-2`,
      date,
      'C1',
      'Cliente análisis',
      'P2',
      'Producto rentable',
      '2',
      '200.25',
      '60.15',
      '0.20',
    ],
    [
      `V-${periodIndex}-3`,
      date,
      'C1',
      'Cliente análisis',
      'P3',
      'Producto sin costo',
      '2',
      '300.25',
      '',
      '0.20',
    ],
  ])
  const csv = [fields, ...rows].map((row) => row.join(',')).join('\n')
  const cents = (value: string) => {
    const [whole, fraction = ''] = value.split('.')
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  }
  const source = csv
    .split('\n')
    .slice(1)
    .map((line) => line.split(','))
  const net = (row: string[]) =>
    Number(row[6]) * cents(row[7]!) - cents(row[9]!)
  const delta = net(source[0]!) - net(source[3]!)
  const expected =
    '+' +
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(delta / 100)
  await page.getByLabel('Tipo de importación').selectOption('sales')
  await page.getByLabel('Archivo', { exact: true }).setInputFiles({
    name: 'analysis.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  })
  await page.getByRole('button', { name: 'Subir archivo' }).click()
  await expect(
    page.getByRole('heading', { name: 'Asignar columnas' }),
  ).toBeVisible()
  for (const field of fields)
    await page.locator(`[name="mapping.${field}"]`).selectOption(field)
  await page.getByRole('button', { name: 'Validar filas' }).click()
  await page.getByRole('button', { name: 'Importar 6 filas válidas' }).click()
  await expect(
    page.getByText('Estado: Completado', { exact: true }),
  ).toBeVisible({ timeout: 60000 })
  await page.goto(`/o/${orgSlug}/margin`)
  const tableRows = page.locator('.analysis-table tbody tr')
  await expect(tableRows).toHaveCount(3)
  await expect(tableRows.first()).toContainText('Producto pérdida')
  await expect(
    tableRows.first().getByText('Riesgo', { exact: true }),
  ).toBeVisible()
  await expect(tableRows.last()).toContainText('Producto sin costo')
  await expect(tableRows.last()).toContainText('Sin datos de costo')
  await expect(tableRows.last().locator('td').nth(1)).toBeEmpty()
  // Por el enlace de la cabecera: sus parámetros no deben añadir filtros.
  await page.getByRole('link', { name: 'Venta', exact: true }).click()
  await expect(page).toHaveURL(/orden=venta/)
  await expect(page).not.toHaveURL(/[?&]q=/)
  await expect(tableRows).toHaveCount(3)
  await expect(tableRows.last()).toContainText('Producto sin costo')
  await page.goto(`/o/${orgSlug}/sales`)
  await expect(
    tableRows.filter({ hasText: 'Producto pérdida' }).locator('td').nth(0),
  ).toHaveText(expected)
  await page.getByLabel('Buscar por nombre').fill('Producto rentable')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(tableRows).toHaveCount(1)
  await page.getByLabel('Buscar por nombre').fill('%')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(tableRows).toHaveCount(0)
  await expect(
    page.getByText('Ningún producto coincide con «%».'),
  ).toBeVisible()
})

test('viewer abre ventas y margen', async ({ page }) => {
  await login(page, email('viewer'), `/o/${slug}/sales`)
  for (const [route, title] of [
    ['sales', 'Ventas'],
    ['margin', 'Margen'],
  ]) {
    await page.goto(`/o/${slug}/${route}`)
    await expect(
      page.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
  }
})
