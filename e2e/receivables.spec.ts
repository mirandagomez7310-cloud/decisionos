import { expect } from '@playwright/test'
import { test, email, importCsv, login, slug } from './fixtures'
import { formatMoney } from '../src/lib/format'
import { todayInMexico } from '../src/lib/server/metrics/period'

test('owner consulta saldos exactos y filtra los clientes de riesgo alto', async ({
  page,
  dashboardOwner: { orgSlug, userEmail },
}) => {
  test.setTimeout(240000)
  await page.context().clearCookies()
  const path = `/o/${orgSlug}`
  const imports = path + '/imports/new'
  await login(page, userEmail, imports)
  const today = todayInMexico(new Date())
  const day = (offset: number) => {
    const date = new Date(today + 'T00:00:00Z')
    date.setUTCDate(date.getUTCDate() + offset)
    return date.toISOString().slice(0, 10)
  }

  await importCsv(
    page,
    imports,
    'customers',
    [
      'code,name,credit_limit',
      'C1,Cliente pagado,',
      'C2,Cliente sobre límite,30.00',
      'C3,Cliente vencido,',
      'C4,Cliente por vencer,',
    ].join('\n'),
  )

  const issued = day(-150)
  const csv = [
    'external_ref,customer_code,issued_on,due_on,amount,paid_amount',
    `R1,C1,${issued},${day(-15)},125.31,125.31`,
    `R2,C2,${issued},${day(-15)},78.45,17.29`,
    `R3,C3,${issued},${day(-100)},1042.87,0.00`,
    `R4,C4,${issued},${day(15)},53.63,0.00`,
  ].join('\n')
  await importCsv(page, imports, 'receivables', csv)

  const cents = (amount: string) => Number(amount.replace('.', ''))
  const total = csv
    .split('\n')
    .slice(1)
    .reduce((sum, line) => {
      const [, , , , amount, paid] = line.split(',')
      return sum + cents(amount!) - cents(paid!)
    }, 0)

  const viewport = page.viewportSize()!
  if (viewport.width < 500)
    await page.setViewportSize({ ...viewport, width: 390 })
  await page.goto(path + '/receivables')
  await expect(
    page
      .getByRole('heading', { name: 'Saldo por cobrar', exact: true })
      .locator('..')
      .locator('.dashboard-figure'),
  ).toHaveText(formatMoney(total / 100))
  const region = page.getByRole('region', {
    name: 'Tabla de cuentas por cobrar por cliente',
  })
  const rows = region.locator('tbody tr')
  await expect(rows).toHaveCount(3)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width)
  if (viewport.width < 500) {
    await expect(region).toHaveAttribute('tabindex', '0')
    expect(
      await region.evaluate((element) => element.scrollWidth),
    ).toBeGreaterThan(390)
  }
  await expect(rows.filter({ hasText: 'Cliente pagado' })).toHaveCount(0)
  for (const name of ['Cliente vencido', 'Cliente sobre límite']) {
    await expect(
      rows.filter({ hasText: name }).getByText('Alto', { exact: true }),
    ).toBeVisible()
  }
  const high = page.getByRole('link', { name: 'Alto (2)', exact: true })
  await high.click()
  await expect(high).toHaveAttribute('aria-current', 'page')
  await expect(rows).toHaveCount(2)
  await expect(rows.filter({ hasText: 'Cliente por vencer' })).toHaveCount(0)
})

test('owner de una organización sin cuentas ve cómo importarlas', async ({
  page,
  dashboardOwner: { orgSlug, userEmail },
}) => {
  await page.context().clearCookies()
  await login(page, userEmail, `/o/${orgSlug}/receivables`)
  await expect(
    page.getByRole('heading', { name: 'Aún no hay cuentas por cobrar' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Importar cuentas por cobrar' }),
  ).toHaveAttribute('href', `/o/${orgSlug}/imports/new`)
})

test('viewer abre cobranza', async ({ page }) => {
  await login(page, email('viewer'), `/o/${slug}/receivables`)
  await expect(
    page.getByRole('heading', { name: 'Cobranza', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
})
