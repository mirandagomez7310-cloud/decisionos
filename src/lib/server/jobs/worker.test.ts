import { beforeEach, expect, it, vi } from 'vitest'
import { runPendingJobs } from './index'
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  run: vi.fn(),
  revert: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }),
}))
vi.mock('./handlers/import', () => ({ handleImport: mocks.run }))
vi.mock('./handlers/revert', () => ({ handleRevert: mocks.revert }))
beforeEach(() => vi.resetAllMocks())
const job = {
  id: 'job',
  organization_id: 'org',
  kind: 'import',
  attempts: 3,
  max_attempts: 3,
  payload: { import_id: 'import' },
}
it('despacha, completa y respeta maxJobs', async () => {
  mocks.rpc
    .mockResolvedValueOnce({ data: job, error: null })
    .mockResolvedValue({ data: null, error: null })
  await runPendingJobs({ maxJobs: 1, worker: 'test' })
  expect(mocks.run).toHaveBeenCalledOnce()
  expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'claim_job', {
    worker: 'test',
    kinds: ['import', 'revert_import'],
  })
  expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'complete_job', {
    id: 'job',
    status: 'done',
    last_error: '',
  })
})
it('registra el fallo terminal con filtro de organización y continúa', async () => {
  const query = { update: vi.fn(), eq: vi.fn() }
  query.update.mockReturnValue(query)
  query.eq
    .mockReturnValueOnce(query)
    .mockResolvedValueOnce({ data: null, error: null })
  mocks.from.mockReturnValue(query)
  mocks.rpc
    .mockResolvedValueOnce({ data: job, error: null })
    .mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({
      data: { ...job, kind: 'revert_import' },
      error: null,
    })
    .mockResolvedValue({ data: null, error: null })
  mocks.run.mockRejectedValueOnce(new Error('fallo de escritura'))
  await expect(runPendingJobs({ maxJobs: 2 })).resolves.toBeUndefined()
  expect(query.eq).toHaveBeenCalledWith('organization_id', 'org')
  expect(query.eq).toHaveBeenCalledWith('id', 'import')
  expect(query.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'failed' }),
  )
  expect(mocks.rpc).toHaveBeenCalledWith('complete_job', {
    id: 'job',
    status: 'failed',
    last_error: 'fallo de escritura',
  })
  expect(mocks.revert).toHaveBeenCalledOnce()
})
