import { expect } from '@playwright/test'
import { test, email, importCsv, login, slug } from './fixtures'
import { todayInMexico } from '../src/lib/server/metrics/period'

test('owner consulta valor exacto, costos y productos sin movimiento después de importar', async ({
  page,
  dashboardOwner: { orgSlug, userEmail },
}) => {
  test.setTimeout(240000)
  await page.context().clearCookies()
  const path = `/o/${orgSlug}`
  const imports = path + '/imports/new'
  await login(page, userEmail, imports)
  const today = todayInMexico(new Date())
  const soldDate = new Date(today + 'T00:00:00Z')
  soldDate.setUTCDate(soldDate.getUTCDate() - 10)

  const products = [
    'sku,name,standard_cost',
    'P1,Producto sin ventas,12.35',
    'P2,Producto vendido,',
    'P3,Producto sin costo,',
    'P4,Producto sin existencias,',
  ].join('\n')
  const inventory = [
    'product_sku,snapshot_on,quantity,unit_cost',
    `P1,${today},7,`,
    `P2,${today},4,5.27`,
    `P3,${today},2,`,
    `P4,${today},0,20.00`,
  ].join('\n')
  const sales = [
    'external_ref,sold_on,customer_code,customer_name,product_sku,quantity,unit_price,unit_cost',
    `V1,${soldDate.toISOString().slice(0, 10)},C1,Cliente inventario,P2,2,15.00,5.27`,
  ].join('\n')
  await importCsv(page, imports, 'products', products)
  await importCsv(page, imports, 'inventory', inventory)
  await importCsv(page, imports, 'sales', sales)

  const standardCosts = new Map(
    products
      .split('\n')
      .slice(1)
      .map((line) => {
        const [sku, , cost] = line.split(',')
        return [sku, cost]
      }),
  )
  const valueInCents = inventory
    .split('\n')
    .slice(1)
    .reduce((sum, line) => {
      const [sku, , quantity, unitCost] = line.split(',')
      const [whole, fraction = ''] = (
        unitCost ||
        standardCosts.get(sku) ||
        '0'
      ).split('.')
      const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
      return sum + Number(quantity) * cents
    }, 0)
  const expected = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(valueInCents / 100)

  const viewport = page.viewportSize()!
  if (viewport.width < 500)
    await page.setViewportSize({ ...viewport, width: 390 })
  await page.goto(path + '/inventory')
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width)
  if (viewport.width < 500) {
    const region = page.getByRole('region', {
      name: 'Tabla de inventario por producto',
    })
    await expect(region).toHaveAttribute('tabindex', '0')
    expect(
      await region.evaluate((element) => element.scrollWidth),
    ).toBeGreaterThan(390)
  }
  await expect(
    page
      .getByRole('heading', { name: 'Valor de inventario', exact: true })
      .locator('xpath=ancestor::section[1]')
      .locator('.dashboard-figure'),
  ).toHaveText(expected)
  const rows = page.getByRole('table').locator('tbody tr')
  await expect(rows).toHaveCount(3)
  const stale = rows.filter({ hasText: 'Producto sin ventas' })
  await expect(stale.getByText('Sin movimiento', { exact: true })).toBeVisible()
  await expect(stale.getByText('Nunca', { exact: true })).toBeVisible()
  const missing = rows.filter({ hasText: 'Producto sin costo' })
  await expect(missing.getByText('Sin costo', { exact: true })).toBeVisible()
  await expect(missing.locator('td').nth(0)).toHaveText('—')
  await expect(missing.locator('td').nth(2)).toHaveText('—')
  await expect(rows.filter({ hasText: 'Producto vendido' })).toContainText(
    '10 días sin venta',
  )
  await page.getByRole('link', { name: 'Sin movimiento', exact: true }).click()
  await expect(rows).toHaveCount(2)
  await expect(rows.filter({ hasText: 'Producto vendido' })).toHaveCount(0)
})

test('owner de una organización sin inventario ve cómo importarlo', async ({
  page,
  dashboardOwner: { orgSlug, userEmail },
}) => {
  await page.context().clearCookies()
  await login(page, userEmail, `/o/${orgSlug}/inventory`)
  await expect(
    page.getByRole('heading', { name: 'Aún no hay inventario' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Importar inventario' }),
  ).toHaveAttribute('href', `/o/${orgSlug}/imports/new`)
})

test('viewer abre inventario', async ({ page }) => {
  await login(page, email('viewer'), `/o/${slug}/inventory`)
  await expect(
    page.getByRole('heading', { name: 'Inventario', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
})
