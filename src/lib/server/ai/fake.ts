import { env } from '@/env'
import type { AdvisorFact } from '../advisor/facts'
import type { AdviceResult } from './index'
import type { AdviceItem } from './schema'

export function generateFakeAdvice(facts: AdvisorFact[]): AdviceResult {
  const first = facts[0]
  if (!first) return { ok: false, error: 'invalid_output' }
  if (env.AI_FAKE_MODE === 'refusal') return { ok: false, error: 'refusal' }

  const field = Object.keys(first.metric_snapshot).find(
    (key) =>
      typeof first.metric_snapshot[
        key as keyof typeof first.metric_snapshot
      ] === 'number',
  )
  const item: AdviceItem = {
    kind: 'suggestion',
    priority: 3,
    title: 'Revisa el indicador',
    body: field
      ? `Revisa los factores detrás de {{${first.id}.${field}}}.`
      : 'Revisa los factores detrás del hecho citado.',
    cites: [first.id],
  }
  const items =
    env.AI_FAKE_MODE === 'invalid'
      ? [
          { ...item, body: 'Revisa 1 indicador.' },
          { ...item, cites: ['hecho-inexistente'] },
        ]
      : [item]

  return {
    ok: true,
    output: { items },
    model: 'fake',
    usage: { input: 0, output: 0 },
  }
}
