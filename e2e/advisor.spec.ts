import { expect } from '@playwright/test'
import { adminClient, email, importCsv, login, slug, test } from './fixtures'

test('owner pide recomendaciones con evidencia y vuelve a usar la caché', async ({
  page,
  dashboardOwner: { orgSlug, userEmail },
}) => {
  test.setTimeout(240000)
  await page.context().clearCookies()
  const insights = `/o/${orgSlug}/insights`
  const imports = `/o/${orgSlug}/imports/new`
  await login(page, userEmail, imports)
  await importCsv(
    page,
    imports,
    'customers',
    'code,name,credit_limit\nC1,Cliente vencido,\nC2,Otro cliente vencido,',
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

  await page.goto(insights)
  const fact = page.getByRole('heading', { name: /clientes con riesgo alto/ })
  await expect
    .poll(
      async () => {
        await page.reload()
        return fact.count()
      },
      { timeout: 60000 },
    )
    .toBe(1)

  const section = page.getByRole('region', { name: 'Recomendaciones' })
  const request = section.getByRole('button', { name: 'Pedir recomendaciones' })
  const quota = section.getByText(/consultas disponibles hoy/)
  await expect(quota).toHaveText('10 de 10 consultas disponibles hoy')
  await request.click()
  await expect(quota).toHaveText('9 de 10 consultas disponibles hoy')
  const recommendation = section.getByRole('article')
  await expect
    .poll(
      async () => {
        await page.reload()
        return recommendation.count()
      },
      { timeout: 60000 },
    )
    .toBe(1)
  await expect(section.getByText('Generado por IA')).toBeVisible()
  await expect(recommendation.getByText(/\$\s*\d|\d\s*%/)).toBeVisible()
  const citation = recommendation
    .getByText('Se apoya en:', { exact: true })
    .locator('..')
    .getByRole('link')
  const href = await citation.getAttribute('href')
  expect(href).toMatch(/\?estado=nuevos#insight-/)
  await citation.click()
  await expect(page).toHaveURL(
    (url) => url.pathname + url.search + url.hash === href,
  )
  await expect(page.locator('article:target').getByRole('heading')).toHaveText(
    (await citation.textContent())!,
  )
  await expect(quota).toHaveText('9 de 10 consultas disponibles hoy')
  await request.click()
  await expect(section.getByRole('status')).toHaveText(
    'Tus hallazgos no han cambiado desde la última consulta; no se gastó ninguna consulta',
  )
  await expect(quota).toHaveText('9 de 10 consultas disponibles hoy')
})

test('viewer ve recomendaciones sin controles de edición', async ({ page }) => {
  const db = adminClient()
  const { data: org, error: orgError } = await db
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()
  if (orgError) throw orgError
  const runId = crypto.randomUUID()
  const id = crypto.randomUUID()
  const title = `Recomendación de prueba ${runId.slice(0, 8)}`
  const { error: runError } = await db.from('advisor_runs').insert({
    id: runId,
    organization_id: org.id,
    period_start: '2000-01-01',
    input_hash: 'a'.repeat(64),
    status: 'done',
    driver: 'fake',
    items: 1,
    finished_at: new Date().toISOString(),
  })
  if (runError) throw runError
  try {
    const { error } = await db.from('insights').insert({
      id,
      organization_id: org.id,
      module: 'cash',
      kind: 'suggestion',
      severity: 'warning',
      title,
      body: 'Revisar saldos pendientes.',
      evidence: { run_id: runId, priority: 3 },
      metric_snapshot: {},
      period_start: '2000-01-01',
      period_end: '2000-01-31',
      generated_by: 'llm',
    })
    if (error) throw error
    await login(page, email('viewer'), `/o/${slug}/insights`)
    const section = page.getByRole('region', { name: 'Recomendaciones' })
    await expect(section.getByRole('heading', { name: title })).toBeVisible()
    await expect(
      section.getByRole('button', { name: 'Pedir recomendaciones' }),
    ).toHaveCount(0)
    await expect(section.locator('form')).toHaveCount(0)
  } finally {
    const recommendation = await db.from('insights').delete().eq('id', id)
    const run = await db.from('advisor_runs').delete().eq('id', runId)
    expect(recommendation.error).toBeNull()
    expect(run.error).toBeNull()
  }
})
