import 'server-only'

import { env } from '@/env'
import type { AdvisorFact } from '../advisor/facts'
import { generateAnthropicAdvice, type AnthropicClient } from './anthropic'
import { generateFakeAdvice } from './fake'
import type { AdviceOutput } from './schema'

export type AdviceResult =
  | {
      ok: true
      output: AdviceOutput
      model: string
      usage: { input: number; output: number }
    }
  | {
      ok: false
      error:
        'disabled' | 'refusal' | 'max_tokens' | 'invalid_output' | 'api_error'
    }

export async function generateAdvice(
  facts: AdvisorFact[],
  client?: AnthropicClient,
): Promise<AdviceResult> {
  try {
    if (env.AI_DRIVER === 'fake') return generateFakeAdvice(facts)
    if (env.AI_DRIVER === 'anthropic')
      return await generateAnthropicAdvice(facts, client)
    return { ok: false, error: 'disabled' }
  } catch {
    return { ok: false, error: 'api_error' }
  }
}
