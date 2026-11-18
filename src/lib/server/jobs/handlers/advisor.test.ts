// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { env } from '@/env'
import { formatMoney } from '@/lib/format'
import { advisorInputHash, loadAdvisorFacts } from '@/lib/server/advisor/facts'
import { todayInMexico } from '@/lib/server/metrics/period'
import type { AdvisorRun } from '@/lib/supabase/types'
import type { Client, Job } from '../shared'
import { handleAdvisor } from './advisor'

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const job = {
  id: 'job',
  organization_id: 'org',
  kind: 'advisor',
  payload: { run_id: 'run' },
  status: 'running',
  attempts: 1,
  max_attempts: 3,
  created_at: '',
  finished_at: null,
  locked_at: null,
  locked_by: null,
  last_error: null,
  progress: {},
  run_after: '',
} satisfies Job
const fact = {
  id,
  rule_key: 'sales_drop',
  module: 'sales',
  severity: 'critical',
  title: 'Ventas',
  body: 'Detalle',
  metric_snapshot: { net_sales: 1200 },
} as const
const factRow = {
  ...fact,
  created_at: '2026-11-18T00:00:00Z',
  metric_snapshot: {
    ...fact.metric_snapshot,
    risk: 'alto',
    coverage: null,
    unknown: 3,
  },
}
const period_start = '2026-11-01'
const ok = <T>(data: T) => ({ data, error: null })

function client(status: AdvisorRun['status'] = 'queued', rows = [factRow]) {
  const rpc = vi.fn().mockResolvedValue(ok(null))
  const insert = vi.fn().mockResolvedValue(ok(null))
  const audit = vi.fn().mockResolvedValue(ok(null))
  const update = vi.fn()
  const eq = vi.fn()
  const run = {
    select: vi.fn().mockReturnThis(),
    eq,
    single: vi
      .fn()
      .mockResolvedValue(
        ok({ status, input_hash: 'hash del cliente', period_start }),
      ),
    update,
  }
  eq.mockReturnValue(run)
  update.mockImplementation(() =>
    Object.assign(Promise.resolve(ok(null)), {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(ok({ id: 'run' })),
    }),
  )
  const filters = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(ok([])).mockResolvedValueOnce(ok(rows)),
    insert,
  }
  const tables = {
    advisor_runs: run,
    insights: filters,
    audit_log: { insert: audit },
  }
  const from = vi.fn((table: keyof typeof tables) => tables[table])
  const db = { from, rpc } as unknown as Client
  return { db, run, update, eq, rpc, insert, audit, from, filters }
}

const originalMode = env.AI_FAKE_MODE
afterEach(() => {
  env.AI_FAKE_MODE = originalMode
  vi.restoreAllMocks()
})

it('usa driver fake, corrige el hash, guarda cifras y audita solo conteos', async () => {
  const { db, eq, update, rpc, insert, audit, filters } = client()
  await handleAdvisor(db, job)

  expect(eq).toHaveBeenCalledWith('organization_id', 'org')
  expect(eq).toHaveBeenCalledWith('id', 'run')
  expect(filters.eq).toHaveBeenCalledWith('organization_id', 'org')
  expect(filters.eq).toHaveBeenCalledWith('kind', 'fact')
  expect(filters.in).toHaveBeenCalledWith('status', ['new', 'seen'])
  expect(update).toHaveBeenNthCalledWith(1, { status: 'running' })
  expect(update).toHaveBeenNthCalledWith(2, {
    input_hash: advisorInputHash([fact]),
  })
  expect(insert).toHaveBeenCalledExactlyOnceWith([
    {
      organization_id: 'org',
      generated_by: 'llm',
      kind: 'suggestion',
      rule_key: null,
      module: 'sales',
      severity: 'critical',
      period_start,
      period_end: todayInMexico(new Date()),
      title: 'Revisa el indicador',
      body: `Revisa los factores detrás de ${formatMoney(1200)}.`,
      metric_snapshot: { [`${id}.net_sales`]: 1200 },
      evidence: { run_id: 'run', cites: [id], priority: 3 },
    },
  ])
  expect(rpc).toHaveBeenCalledExactlyOnceWith('complete_advisor_run', {
    p_run_id: 'run',
    p_status: 'done',
    p_error: null,
    p_driver: 'fake',
    p_model: 'fake',
    p_input_tokens: 0,
    p_output_tokens: 0,
    p_items: 1,
  })
  expect(audit).toHaveBeenCalledExactlyOnceWith({
    organization_id: 'org',
    actor_kind: 'system',
    action: 'advisor.completed',
    entity: 'advisor_runs',
    entity_id: 'run',
    data: { items: 1, rejected: 0, input_tokens: 0, output_tokens: 0 },
  })
})

it('solo conserva los veinte hechos más graves y los campos conocidos numéricos', async () => {
  const { db, filters } = client()
  const newest = {
    ...factRow,
    id: 'reciente',
    created_at: '2026-11-19T00:00:00Z',
  }
  const warnings = Array.from({ length: 18 }, (_, index) => ({
    ...factRow,
    id: String(index),
    severity: 'warning',
  }))
  filters.limit
    .mockReset()
    .mockResolvedValueOnce(ok([newest, factRow]))
    .mockResolvedValueOnce(ok(warnings))
  const facts = await loadAdvisorFacts(db, 'org')
  expect(facts).toHaveLength(20)
  expect(facts.slice(0, 2)).toEqual([{ ...fact, id: newest.id }, fact])
  expect(filters.limit.mock.calls).toEqual([[20], [18]])
})

it.each(['running', 'done', 'failed'] as const)(
  'omite una ejecución %s',
  async (status) => {
    const { db, from, update, rpc } = client(status)
    await handleAdvisor(db, job)
    expect(from).toHaveBeenCalledExactlyOnceWith('advisor_runs')
    expect(update).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  },
)

it('rechaza una ejecución ausente en la organización del job', async () => {
  const { db, run, update } = client()
  run.single.mockResolvedValue(ok(null))
  await expect(handleAdvisor(db, job)).rejects.toThrow('inexistente')
  expect(update).not.toHaveBeenCalled()
})

it.each([
  ['no_facts', 'ok', []],
  ['refusal', 'refusal', [factRow]],
  ['no_valid_items', 'invalid', [factRow]],
] as const)('termina sin reintentar ante %s', async (error, mode, rows) => {
  env.AI_FAKE_MODE = mode
  const { db, rpc, insert, audit } = client('queued', [...rows])
  await expect(handleAdvisor(db, job)).resolves.toBeUndefined()
  expect(rpc).toHaveBeenCalledExactlyOnceWith(
    'complete_advisor_run',
    expect.objectContaining({
      p_status: 'failed',
      p_error: error,
    }),
  )
  expect(insert).not.toHaveBeenCalled()
  expect(audit).not.toHaveBeenCalled()
})

it('permite reintentar un fallo de carga previo al modelo', async () => {
  const { db, filters, update, rpc } = client()
  filters.limit
    .mockReset()
    .mockResolvedValue({ data: null, error: { message: 'fallo de lectura' } })
  await expect(handleAdvisor(db, job)).rejects.toThrow('fallo de lectura')
  expect(update).toHaveBeenLastCalledWith({ status: 'queued' })
  expect(rpc).not.toHaveBeenCalled()
})

it('marca el fallo de persistencia sin lanzar ni registrar el contenido', async () => {
  const { db, insert, rpc } = client()
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  insert.mockResolvedValue({
    data: null,
    error: { message: 'contenido sensible' },
  })
  await expect(handleAdvisor(db, job)).resolves.toBeUndefined()
  expect(rpc).toHaveBeenCalledExactlyOnceWith(
    'complete_advisor_run',
    expect.objectContaining({
      p_status: 'failed',
      p_error: 'persistence_error',
    }),
  )
  expect(log).toHaveBeenCalledExactlyOnceWith(
    'Falló la persistencia de la asesoría',
  )
})
