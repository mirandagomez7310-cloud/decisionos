import { expect } from '@playwright/test'
import { toolingEnv } from '../tooling-env'
import { adminClient, importCsv, login, test } from './fixtures'

test('owner recibe alertas agrupadas una sola vez al recalcular', async ({
  page,
  request,
  dashboardOwner: { orgSlug, userEmail },
}) => {
  test.setTimeout(240000)
  await page.context().clearCookies()
  const imports = `/o/${orgSlug}/imports/new`
  const mailpit = new URL('/api/v1/', toolingEnv.mailpitUrl)
  const search = new URL('search', mailpit)
  search.searchParams.set('query', `to:"${userEmail}"`)

  async function messages() {
    const response = await request.get(search.href)
    await expect(response).toBeOK()
    const { messages } = (await response.json()) as {
      messages: { ID: string; Subject: string }[] | null
    }
    return messages ?? []
  }

  const db = adminClient()
  const { data: org, error: orgError } = await db
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single()
  if (orgError) throw orgError
  const organizationId = org.id
  async function completedAlertJobs() {
    const { count, error } = await db
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('kind', 'send_alerts')
      .eq('status', 'done')
    if (error) throw error
    return count
  }

  const customers = 'code,name,credit_limit'
  await login(page, userEmail, imports)
  try {
    await importCsv(
      page,
      imports,
      'customers',
      `${customers}\nC1,Cliente vencido,\nC2,Otro cliente vencido,`,
    )
    await expect.poll(completedAlertJobs, { timeout: 60000 }).toBe(1)
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
    await expect
      .poll(async () => (await messages()).length, { timeout: 60000 })
      .toBe(1)
    const [message] = await messages()
    expect(message!.Subject).toMatch(/^DecisionOS · 2 alertas nuevas/)
    const response = await request.get(
      new URL(`message/${message!.ID}`, mailpit).href,
    )
    await expect(response).toBeOK()
    const { Text, HTML } = (await response.json()) as {
      Text: string
      HTML: string
    }
    const link = new URL(`/o/${orgSlug}/insights`, toolingEnv.appUrl).href
    expect(Text).toContain('clientes con riesgo alto')
    expect(Text).toContain('de la cobranza está vencido')
    expect(Text).toContain(link)
    expect(HTML).toContain(`href="${link}"`)

    await expect.poll(completedAlertJobs, { timeout: 60000 }).toBe(2)
    await importCsv(
      page,
      imports,
      'customers',
      `${customers}\nC3,Cliente nuevo,`,
    )
    await expect.poll(completedAlertJobs, { timeout: 60000 }).toBe(3)
    // Solo los IDs: abrir el mensaje lo marca como leído en Mailpit.
    expect((await messages()).map(({ ID }) => ID)).toEqual([message!.ID])
  } finally {
    const IDs = (await messages()).map(({ ID }) => ID)
    if (IDs.length) {
      const response = await request.delete(new URL('messages', mailpit).href, {
        data: { IDs },
      })
      await expect(response).toBeOK()
    }
  }
})
