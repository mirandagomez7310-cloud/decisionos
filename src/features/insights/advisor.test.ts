import { beforeEach, expect, it, vi } from 'vitest'
import { requestAdvice } from './advisor-actions'
import {
  adviceError,
  priorityLabel,
  remainingAdvice,
  sortRecommendations,
} from './advisor'

const mocks = vi.hoisted(() => ({
  env: { AI_DRIVER: 'fake' as string | undefined },
  requireRole: vi.fn(),
  createClient: vi.fn(),
  loadAdvisorFacts: vi.fn(),
  advisorInputHash: vi.fn(),
  rpc: vi.fn(),
  after: vi.fn(),
  runPendingJobs: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock('@/env', () => ({ env: mocks.env }))
vi.mock('@/lib/server/auth', () => ({ requireRole: mocks.requireRole }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/server/advisor/facts', () => mocks)
vi.mock('@/lib/server/jobs', () => ({ runPendingJobs: mocks.runPendingJobs }))
vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.env.AI_DRIVER = 'fake'
  mocks.requireRole.mockResolvedValue({ organization: { id: 'org-id' } })
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc })
  mocks.loadAdvisorFacts.mockResolvedValue([{ id: 'fact-id' }])
  mocks.advisorInputHash.mockReturnValue('a'.repeat(64))
  mocks.rpc.mockResolvedValue({ data: { status: 'queued' }, error: null })
})

it('valida el slug antes de autorizar', async () => {
  expect(await requestAdvice('../otro')).toEqual({ status: 'error' })
  expect(mocks.requireRole).not.toHaveBeenCalled()
  expect(mocks.createClient).not.toHaveBeenCalled()
})

it('propaga la redirección de autorización antes de consultar datos', async () => {
  mocks.requireRole.mockRejectedValue(new Error('NEXT_REDIRECT'))
  await expect(requestAdvice('demo')).rejects.toThrow('NEXT_REDIRECT')
  expect(mocks.createClient).not.toHaveBeenCalled()
  expect(mocks.loadAdvisorFacts).not.toHaveBeenCalled()
  expect(mocks.rpc).not.toHaveBeenCalled()
})

it('devuelve disabled sin RPC después de autorizar', async () => {
  mocks.env.AI_DRIVER = undefined
  expect(await requestAdvice('demo')).toEqual({ status: 'disabled' })
  expect(mocks.requireRole).toHaveBeenCalledWith(
    'demo',
    'owner',
    'admin',
    'analyst',
  )
  expect(mocks.rpc).not.toHaveBeenCalled()
})

it('devuelve no_facts sin RPC si faltan hechos activos', async () => {
  mocks.loadAdvisorFacts.mockResolvedValue([])
  expect(await requestAdvice('demo')).toEqual({ status: 'no_facts' })
  expect(mocks.rpc).not.toHaveBeenCalled()
})

it('programa el trabajo encolado y revalida Diagnóstico', async () => {
  expect(await requestAdvice('demo')).toEqual({ status: 'queued' })
  expect(mocks.requireRole).toHaveBeenCalledBefore(mocks.createClient)
  expect(mocks.loadAdvisorFacts).toHaveBeenCalledWith(
    { rpc: mocks.rpc },
    'org-id',
  )
  expect(mocks.rpc).toHaveBeenCalledWith('request_advisor', {
    p_organization_id: 'org-id',
    p_input_hash: 'a'.repeat(64),
  })
  expect(mocks.after).toHaveBeenCalledExactlyOnceWith(mocks.runPendingJobs)
  expect(mocks.after).toHaveBeenCalledBefore(mocks.revalidatePath)
  expect(mocks.revalidatePath).toHaveBeenCalledWith('/o/demo/insights')
})

it.each(['running', 'cached', 'limit'])(
  'devuelve %s sin programar otro trabajo',
  async (status) => {
    mocks.rpc.mockResolvedValue({ data: { status }, error: null })
    expect(await requestAdvice('demo')).toEqual({ status })
    expect(mocks.after).not.toHaveBeenCalled()
  },
)

it('devuelve el error del RPC como dato', async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501' } })
  expect(await requestAdvice('demo')).toEqual({ status: 'error' })
  expect(mocks.after).not.toHaveBeenCalled()
  expect(mocks.revalidatePath).not.toHaveBeenCalled()
})

it('ordena recomendaciones por prioridad y fecha descendente', () => {
  const rows = [
    { evidence: { priority: 3 }, created_at: '2026-11-18' },
    { evidence: { priority: 1 }, created_at: '2026-11-16' },
    { evidence: null, created_at: '2026-11-18' },
    { evidence: { priority: 1 }, created_at: '2026-11-17' },
  ]
  expect(sortRecommendations(rows).map(({ evidence }) => evidence)).toEqual([
    rows[3]?.evidence,
    rows[1]?.evidence,
    rows[0]?.evidence,
    null,
  ])
})

it.each([
  [1, 'alta'],
  [2, 'alta'],
  [3, 'media'],
  [4, 'baja'],
  [5, 'baja'],
])('rotula la prioridad %i como %s', (priority, label) => {
  expect(priorityLabel(priority)).toBe(`Prioridad ${label}`)
})

it.each([
  ['refusal', 'con estos hallazgos'],
  ['max_tokens', 'quedó incompleta'],
  ['api_error', 'no respondió'],
  ['invalid_output', 'no se pudo usar'],
  ['no_valid_items', 'respaldadas por tus hallazgos'],
  ['no_facts', 'Primero importa datos'],
  ['disabled', 'no están activas'],
  ['busy', 'No pudimos completar'],
])('muestra un mensaje claro para %s', (error, message) => {
  expect(adviceError(error)).toContain(message)
})

it.each([
  [0, 10],
  [1, 9],
  [10, 0],
  [11, 0],
])('con %i consultas usadas quedan %i de 10', (used, remaining) =>
  expect(remainingAdvice(used, 10)).toBe(remaining),
)
