import { afterEach, expect, it, vi } from 'vitest'
import type { InsightRule } from '@/lib/supabase/types'
import type { Client, Job } from '../shared'
import { handleComputeInsights } from './insights'

const job = {
  id: 'job',
  organization_id: 'org',
  kind: 'compute_insights',
  payload: {},
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

const candidate = {
  rule_key: 'sales_drop',
  module: 'sales',
  severity: 'critical',
  period_start: '2026-10-01',
  period_end: '2026-10-31',
  evidence: {},
  metric_snapshot: {
    net_sales_change_pct: '-20',
    net_sales: 800,
    prev_net_sales: 1000,
  },
} satisfies InsightRule

function client(candidates: InsightRule[]) {
  const rpc = vi.fn().mockResolvedValue({ data: candidates, error: null })
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null })
  const insert = vi.fn().mockResolvedValue({ data: null, error: null })
  const from = vi.fn(() => ({ upsert, insert }))
  return { db: { rpc, from } as unknown as Client, rpc, from, upsert, insert }
}

afterEach(() => vi.useRealTimers())

it('evalúa con la fecha de México, conserva duplicados y audita las reglas', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-12-01T02:00:00Z'))
  const { db, rpc, from, upsert, insert } = client([candidate])

  await handleComputeInsights(db, job)

  expect(rpc).toHaveBeenNthCalledWith(1, 'evaluate_insight_rules', {
    p_organization_id: 'org',
    p_as_of: '2026-11-30',
  })
  expect(rpc).toHaveBeenNthCalledWith(2, 'enqueue_alerts', {
    p_organization_id: 'org',
  })
  expect(from.mock.calls).toEqual([['insights'], ['audit_log']])
  expect(upsert).toHaveBeenCalledExactlyOnceWith(
    [
      {
        ...candidate,
        organization_id: 'org',
        kind: 'fact',
        generated_by: 'rule',
        status: 'new',
        title: 'Las ventas de octubre 2026 cayeron −20.0\u2009%',
        body: 'Venta neta de $800.00 frente a $1,000.00 el mes anterior.',
      },
    ],
    {
      onConflict: 'organization_id,rule_key,period_start',
      ignoreDuplicates: true,
    },
  )
  expect(insert).toHaveBeenCalledExactlyOnceWith({
    organization_id: 'org',
    actor_kind: 'system',
    action: 'insights.computed',
    entity: 'insights',
    entity_id: 'job',
    data: { candidates: 1, rules: ['sales_drop'] },
  })
})

it('audita el cálculo vacío y encola posibles reintentos', async () => {
  const { db, from, insert, rpc } = client([])
  await handleComputeInsights(db, job)
  expect(from.mock.calls).toEqual([['audit_log']])
  expect(rpc).toHaveBeenLastCalledWith('enqueue_alerts', {
    p_organization_id: 'org',
  })
  expect(insert).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ data: { candidates: 0, rules: [] } }),
  )
})

it('rechaza un job sin organización antes de consultar', async () => {
  const { db, rpc, from } = client([])
  await expect(
    handleComputeInsights(db, { ...job, organization_id: null }),
  ).rejects.toThrow('sin organización')
  expect(rpc).not.toHaveBeenCalled()
  expect(from).not.toHaveBeenCalled()
})
