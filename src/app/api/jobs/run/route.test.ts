import { beforeEach, expect, it, vi } from 'vitest'
const run = vi.hoisted(() => vi.fn())
vi.mock('@/env', () => ({ env: { JOBS_SECRET: 'secret-é' } }))
vi.mock('@/lib/server/jobs', () => ({ runPendingJobs: run }))
import { POST } from './route'

beforeEach(() => vi.clearAllMocks())
it.each([null, '', 'Bearer bad', 'Bearer secret-xx', 'Bearer secret-à'])(
  'deniega credencial inválida %s sin ejecutar jobs',
  async (authorization) => {
    const response = await POST(
      new Request('http://localhost/api/jobs/run', {
        headers: authorization === null ? {} : { authorization },
      }),
    )
    expect(response.status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  },
)
it('acepta la credencial exacta', async () => {
  expect(
    (
      await POST(
        new Request('http://localhost/api/jobs/run', {
          headers: { authorization: 'Bearer secret-é' },
        }),
      )
    ).status,
  ).toBe(204)
  expect(run).toHaveBeenCalledOnce()
})
