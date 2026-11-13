import { expect, it, vi } from 'vitest'
import { POST } from './route'
import { runPendingJobs } from '@/lib/server/jobs'
vi.mock('@/lib/server/jobs', () => ({ runPendingJobs: vi.fn() }))
it('rechaza solicitudes sin secreto y ejecuta las autorizadas', async () => {
  const denied = await POST(
    new Request('https://example.com/api/jobs/run', { method: 'POST' }),
  )
  expect(denied.status).toBe(401)
  expect(await denied.text()).toBe('')
  expect(runPendingJobs).not.toHaveBeenCalled()
  const allowed = await POST(
    new Request('https://example.com/api/jobs/run', {
      method: 'POST',
      headers: { Authorization: 'Bearer jobs_test_secret' },
    }),
  )
  expect(allowed.status).toBe(204)
  expect(runPendingJobs).toHaveBeenCalledOnce()
})
