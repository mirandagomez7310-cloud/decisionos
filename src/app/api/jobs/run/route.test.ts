import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const { run, rpc } = vi.hoisted(() => ({ run: vi.fn(), rpc: vi.fn() }))
vi.mock('@/env', () => ({ env: { CRON_SECRET: 'secret-é' } }))
vi.mock('@/lib/server/jobs', () => ({ runPendingJobs: run }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc }) }))
import { POST } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockReset().mockResolvedValue({ error: null })
})
afterEach(() => vi.restoreAllMocks())

function authorizedRequest(schedule?: string) {
  const headers = new Headers({ authorization: 'Bearer secret-é' })
  if (schedule !== undefined) headers.set('ce-vssschedulename', schedule)
  return new Request('http://localhost/api/jobs/run', {
    method: 'POST',
    headers,
  })
}

it.each([null, '', 'Bearer bad', 'Bearer secret-xx', 'Bearer secret-à'])(
  'deniega credencial inválida %s sin ejecutar jobs',
  async (authorization) => {
    const response = await POST(
      new Request('http://localhost/api/jobs/run', {
        headers: {
          'ce-vssschedulename': 'daily-insights',
          ...(authorization === null ? {} : { authorization }),
        },
      }),
    )
    expect(response.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  },
)
it.each([undefined, 'jobs-sweep'])(
  'solo barre la cola con %s',
  async (schedule) => {
    expect((await POST(authorizedRequest(schedule))).status).toBe(204)
    expect(rpc).not.toHaveBeenCalled()
    expect(run).toHaveBeenCalledOnce()
  },
)

it.each(['desconocida', ''])(
  'rechaza la tarea %s sin ejecutar jobs',
  async (schedule) => {
    expect((await POST(authorizedRequest(schedule))).status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  },
)

it.each([
  ['daily-insights', 'enqueue_daily_insights'],
  ['weekly-reports', 'enqueue_weekly_reports'],
])('encola %s antes de procesar la cola', async (schedule, procedure) => {
  expect((await POST(authorizedRequest(schedule))).status).toBe(204)
  expect(rpc).toHaveBeenCalledExactlyOnceWith(procedure)
  expect(rpc).toHaveBeenCalledBefore(run)
  expect(run).toHaveBeenCalledOnce()
})

it('registra el fallo del RPC y responde 500 sin procesar la cola', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  rpc.mockResolvedValue({
    error: { code: '42501', message: 'Detalle interno' },
  })
  const response = await POST(authorizedRequest('weekly-reports'))
  expect(response.status).toBe(500)
  expect(await response.text()).toBe('')
  expect(log).toHaveBeenCalledExactlyOnceWith(
    'No se pudo encolar la tarea programada',
    'weekly-reports',
    '42501',
  )
  expect(run).not.toHaveBeenCalled()
})
