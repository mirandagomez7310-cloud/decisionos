import { expect } from '@playwright/test'
import { adminClient, email, importCsv, login, slug, test } from './fixtures'

test('owner sigue la evidencia y marca el hallazgo como hecho', async ({
  page,
  dashboardOwner: { orgSlug, userEmail },
}) => {
  test.setTimeout(240000)
  await page.context().clearCookies()
  const home = `/o/${orgSlug}`
  const insights = home + '/insights'
  const imports = home + '/imports/new'
  await login(page, userEmail, imports)
  await importCsv(
    page,
    imports,
    'customers',
    [
      'code,name,credit_limit',
      'C1,Cliente vencido,',
      'C2,Otro cliente vencido,',
    ].join('\n'),
  )
  await importCsv(
    page,
    imports,
    'receivables',
    [
      'external_ref,customer_code,issued_on,due_on,amount,paid_amount',
      'R1,C1,2025-01-01,2025-02-01,1042.87,0.00',
      'R2,C2,2025-01-01,2025-02-01,1042.87,0.00',
    ].join('\n'),
  )

  const title = /clientes con riesgo alto/
  await page.goto(insights)
  const article = page.getByRole('article').filter({ hasText: title })
  await expect
    .poll(
      async () => {
        await page.reload()
        return article.count()
      },
      { timeout: 60000 },
    )
    .toBe(1)
  await expect(article.getByText('Crítico', { exact: true })).toBeVisible()

  const viewport = page.viewportSize()!
  if (viewport.width < 500)
    await page.setViewportSize({ ...viewport, width: 390 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width)

  await page.goto(home)
  await expect(page.getByRole('heading', { name: 'Diagnóstico' })).toBeVisible()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.getByRole('link', { name: 'Ver diagnóstico' }).click()
  await article.getByRole('link', { name: 'Ver evidencia' }).click()
  await expect(page).toHaveURL(home + '/receivables?riesgo=alto')
  await expect(page.getByRole('link', { name: 'Alto (2)' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await page.goBack()
  await article.getByRole('button', { name: 'Resuelto', exact: true }).click()
  await expect(article).toHaveCount(0)
  await page.getByRole('link', { name: 'Resueltos (1)' }).click()
  await expect(article.getByRole('heading', { name: title })).toBeVisible()
  await expect(article.getByRole('button', { name: 'Reabrir' })).toBeVisible()
  await page.goto(home)
  await expect(page.getByRole('heading', { name: title })).toHaveCount(0)
})

test('viewer ve el hallazgo sin controles de estado', async ({ page }) => {
  const db = adminClient()
  const { data: org, error: orgError } = await db
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()
  if (orgError) throw orgError
  const id = crypto.randomUUID()
  // Único por ejecución: los proyectos corren en paralelo sobre la misma organización.
  const title = `Hallazgo de prueba del viewer ${id.slice(0, 8)}`
  const { error } = await db.from('insights').insert({
    id,
    organization_id: org.id,
    module: 'cash',
    kind: 'suggestion',
    severity: 'warning',
    title,
    body: 'Revisar saldos pendientes.',
    evidence: {},
    metric_snapshot: {},
    period_start: '2026-11-01',
    period_end: '2026-11-17',
    generated_by: 'llm',
  })
  if (error) throw error
  try {
    await login(page, email('viewer'), `/o/${slug}/insights`)
    const article = page.getByRole('article').filter({ hasText: title })
    await expect(article.getByRole('heading', { name: title })).toBeVisible()
    await expect(article.locator('form')).toHaveCount(0)
  } finally {
    const { error: cleanupError } = await db
      .from('insights')
      .delete()
      .eq('id', id)
    expect(cleanupError).toBeNull()
  }
})
