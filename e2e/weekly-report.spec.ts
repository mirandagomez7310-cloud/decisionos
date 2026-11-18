import { expect } from '@playwright/test'
import { toolingEnv } from '../tooling-env'
import { adminClient, importCsv, login, test } from './fixtures'

test('owner recibe un solo resumen semanal con cobranza vencida', async ({
  page,
  request,
  dashboardOwner: { orgSlug, userEmail },
}) => {
  test.setTimeout(240000)
  const secret = process.env.JOBS_SECRET
  if (!secret) throw new Error('Falta JOBS_SECRET')
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

  const reports = async () =>
    (await messages()).filter(({ Subject }) =>
      Subject.startsWith('DecisionOS · Resumen semanal'),
    )
  const db = adminClient()
  const { data: org, error } = await db
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single()
  if (error) throw error

  const organizationId = org.id

  async function completedReports() {
    const { count, error } = await db
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('kind', 'weekly_report')
      .eq('status', 'done')
    if (error) throw error
    return count ?? 0
  }

  async function enqueueAndRun() {
    const completed = await completedReports()
    const { error } = await db.rpc('enqueue_weekly_reports')
    if (error) throw error
    await expect
      .poll(
        async () => {
          const response = await request.post('/api/jobs/run', {
            headers: { Authorization: `Bearer ${secret}` },
          })
          expect(response.status()).toBe(204)
          return completedReports()
        },
        { timeout: 60000 },
      )
      .toBeGreaterThan(completed)
  }

  await page.context().clearCookies()
  await login(page, userEmail, imports)
  try {
    await importCsv(
      page,
      imports,
      'customers',
      'code,name,credit_limit\nC1,Cliente vencido,',
    )
    await importCsv(
      page,
      imports,
      'receivables',
      [
        'external_ref,customer_code,issued_on,due_on,amount,paid_amount',
        'R1,C1,2025-01-01,2025-02-01,1042.87,0.00',
      ].join('\n'),
    )

    await enqueueAndRun()
    await expect.poll(async () => (await reports()).length).toBe(1)
    const [message] = await reports()
    const response = await request.get(
      new URL(`message/${message!.ID}`, mailpit).href,
    )
    await expect(response).toBeOK()
    const { Text, HTML } = (await response.json()) as {
      Text: string
      HTML: string
    }
    const link = new URL(`/o/${orgSlug}/insights`, toolingEnv.appUrl).href
    expect(Text).toContain('Cobranza vencida: $1,042.87')
    expect(Text).toContain(link)
    expect(HTML).toContain(`href="${link}"`)

    await enqueueAndRun()
    expect((await reports()).map(({ ID }) => ID)).toEqual([message!.ID])
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
