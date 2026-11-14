import { test as base, expect } from '@playwright/test'
import { adminClient, email, login, password, slug } from './fixtures'
import { todayInMexico, resolvePeriod } from '../src/lib/server/metrics/period'

const test = base.extend<{
  dashboardOwner: { orgSlug: string; userEmail: string }
}>({
  dashboardOwner: async ({}, use) => {
    const db = adminClient()
    const suffix = crypto.randomUUID()
    const orgSlug = `dashboard-${suffix}`
    const userEmail = `dashboard-${suffix}@example.com`
    const { data: user, error: userError } = await db.auth.admin.createUser({
      email: userEmail,
      password,
      email_confirm: true,
    })
    expect(userError).toBeNull()
    const { data: org, error: orgError } = await db
      .from('organizations')
      .insert({ name: 'Dashboard E2E', slug: orgSlug })
      .select('id')
      .single()
    expect(orgError).toBeNull()
    try {
      const { error } = await db.from('memberships').insert({
        organization_id: org!.id,
        user_id: user.user!.id,
        role: 'owner',
      })
      expect(error).toBeNull()
      await use({ orgSlug, userEmail })
    } finally {
      if (org) {
        const { error } = await db
          .from('organizations')
          .delete()
          .eq('id', org.id)
        expect(error).toBeNull()
      }
      if (user.user) {
        const { error } = await db.auth.admin.deleteUser(user.user.id)
        expect(error).toBeNull()
      }
    }
  },
})

test('owner importa el CSV y ve cifras ejecutivas exactas', async ({
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
  const rows = Array.from({ length: 9 }, (_, index) => [
    `VENTA-${index}`,
    index < 6 ? period.to : period.prevTo,
    'C1',
    'Cliente de prueba',
    `P${index % 3}`,
    `Producto ${index % 3}`,
    '2',
    index < 6 ? '100.25' : '80.10',
    index % 3 === 0 ? '' : '60.15',
    '0.20',
  ])
  const csv = [fields.join(','), ...rows.map((row) => row.join(','))].join('\n')
  // El oráculo lee el archivo origen y opera exclusivamente con centavos enteros.
  const cents = (value: string) => {
    const [whole, fraction = ''] = value.split('.')
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  }
  const source = csv
    .split('\n')
    .slice(1)
    .map((line) => line.split(','))
  const totals = (lines: string[][]) =>
    lines.reduce(
      (sum, row) => {
        const quantity = Number(row[6])
        const net = quantity * cents(row[7]!) - cents(row[9]!)
        const hasCost = row[8] !== ''
        return {
          net: sum.net + net,
          base: sum.base + (hasCost ? net : 0),
          margin: sum.margin + (hasCost ? net - quantity * cents(row[8]!) : 0),
        }
      },
      { net: 0, base: 0, margin: 0 },
    )
  const current = totals(source.slice(0, 6))
  const previous = totals(source.slice(6))
  const money = (value: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value / 100)
  const oneDecimal = (numerator: number, denominator: number) =>
    (Math.round((numerator * 1000) / denominator) / 10).toFixed(1)
  await page.getByLabel('Tipo de importación').selectOption('sales')
  await page.getByLabel('Archivo', { exact: true }).setInputFiles({
    name: 'dashboard.csv',
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
  await page.getByRole('button', { name: 'Importar 9 filas válidas' }).click()
  await expect(
    page.getByText('Estado: Completado', { exact: true }),
  ).toBeVisible({ timeout: 60000 })
  await page.goto(`/o/${orgSlug}`)
  const sales = page.locator('.dashboard-metric').nth(0)
  const margin = page.locator('.dashboard-metric').nth(1)
  await expect(sales.locator('.dashboard-figure')).toHaveText(
    money(current.net),
  )
  await expect(sales.locator('.metric-comparison')).toHaveText(
    `+${oneDecimal(current.net - previous.net, previous.net)}\u2009% frente a ${money(previous.net)}`,
  )
  await expect(margin.locator('.dashboard-figure')).toHaveText(
    `${money(current.margin)} · ${oneDecimal(current.margin, current.base)}\u2009%`,
  )
  await expect(margin.locator('.metric-status')).toHaveText(
    `Cobertura: ${oneDecimal(current.base, current.net)} % del importe con costo`,
  )
  const points = (
    Number(oneDecimal(current.margin, current.base)) -
    Number(oneDecimal(previous.margin, previous.base))
  ).toFixed(1)
  await expect(margin.locator('.metric-comparison')).toHaveText(
    `${Number(points) >= 0 ? '+' : '−'}${points.replace('-', '')} pts frente a ${oneDecimal(previous.margin, previous.base)}\u2009%`,
  )
})

test('organización sin ventas ofrece importar al owner', async ({
  page,
  dashboardOwner: { orgSlug, userEmail },
}) => {
  await page.context().clearCookies()
  await login(page, userEmail, `/o/${orgSlug}`)
  await expect(
    page.getByRole('heading', { name: 'Aún no hay datos' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Importar ventas' }),
  ).toBeVisible()
})

test('viewer ve el dashboard y no ve el botón de importar', async ({
  page,
}) => {
  await login(page, email('viewer'), `/o/${slug}`)
  await expect(
    page.getByRole('heading', { name: 'Resumen ejecutivo' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Importar ventas', exact: true }),
  ).toHaveCount(0)
})
