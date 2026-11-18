import 'server-only'

import Anthropic from '@anthropic-ai/sdk'
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'
import { env } from '@/env'
import type { AdvisorFact } from '../advisor/facts'
import type { AdviceResult } from './index'
import { SYSTEM_PROMPT } from './prompt'
import { adviceJsonSchema, adviceSchema } from './schema'

// Claude admite un subconjunto de JSON Schema. Zod valida todos los límites.
const { schema } = jsonSchemaOutputFormat(adviceJsonSchema)

export type AnthropicClient = {
  beta: {
    messages: {
      create: (
        params: Anthropic.Beta.MessageCreateParamsNonStreaming,
      ) => PromiseLike<
        Pick<
          Anthropic.Beta.BetaMessage,
          'content' | 'stop_reason' | 'model'
        > & {
          usage: Pick<
            Anthropic.Beta.BetaUsage,
            'input_tokens' | 'output_tokens'
          >
        }
      >
    }
  }
}

export async function generateAnthropicAdvice(
  facts: AdvisorFact[],
  client?: AnthropicClient,
): Promise<AdviceResult> {
  try {
    // El job admite un solo intento de pago, incluidos los reintentos del SDK.
    const sdk: AnthropicClient =
      client ?? new Anthropic({ maxRetries: 0, logLevel: 'off' })
    const response = await sdk.beta.messages.create({
      model: env.AI_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema },
      },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: JSON.stringify({ facts }) }],
    })
    if (
      response.stop_reason === 'refusal' ||
      response.stop_reason === 'max_tokens'
    )
      return { ok: false, error: response.stop_reason }

    const block = response.content.find((part) => part.type === 'text')
    if (!block) return { ok: false, error: 'invalid_output' }
    try {
      const output = adviceSchema.safeParse(JSON.parse(block.text))
      if (output.success)
        return {
          ok: true,
          output: output.data,
          model: response.model,
          usage: {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens,
          },
        }
    } catch {
      return { ok: false, error: 'invalid_output' }
    }
    return { ok: false, error: 'invalid_output' }
  } catch (error) {
    if (error instanceof Anthropic.APIError) console.error(error.status)
    return { ok: false, error: 'api_error' }
  }
}
