// @vitest-environment node
import Anthropic from '@anthropic-ai/sdk'
import { afterEach, expect, it, vi } from 'vitest'
import { env } from '@/env'
import type { AdvisorFact } from '../advisor/facts'
import { validateAdvice } from '../advisor/validate'
import { generateAdvice } from './index'
import { SYSTEM_PROMPT } from './prompt'

const original = { ...env }
afterEach(() => {
  Object.assign(env, original)
  vi.restoreAllMocks()
})

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const facts: AdvisorFact[] = [
  {
    id,
    rule_key: 'sales_drop',
    module: 'sales',
    severity: 'critical',
    title: 'Ventas',
    body: 'Datos de ventas',
    metric_snapshot: { net_sales: 1234.56 },
  },
]
const output = {
  items: [
    {
      kind: 'suggestion',
      priority: 3,
      title: 'Revisa las ventas',
      body: `Ventas de {{${id}.net_sales}}`,
      cites: [id],
    },
  ],
}
const usage = { input_tokens: 31, output_tokens: 12 }
const text = (value: string): Anthropic.Beta.BetaTextBlock => ({
  type: 'text',
  text: value,
  citations: null,
})

function mockClient() {
  env.AI_DRIVER = 'anthropic'
  env.AI_MODEL = 'modelo-de-prueba'
  const response = {
    stop_reason: 'end_turn' as const,
    content: [text(JSON.stringify(output))],
    model: 'modelo-efectivo',
    usage,
  }
  const create = vi
    .fn<import('./anthropic').AnthropicClient['beta']['messages']['create']>()
    .mockResolvedValue(response)
  return { client: { beta: { messages: { create } } }, create, response }
}

it('queda deshabilitado sin driver', async () => {
  env.AI_DRIVER = undefined
  await expect(generateAdvice(facts)).resolves.toEqual({
    ok: false,
    error: 'disabled',
  })
})

it.each([
  ['ok', 1, 0],
  ['invalid', 0, 2],
] as const)('el driver fake produce modo %s', async (mode, valid, rejected) => {
  env.AI_DRIVER = 'fake'
  env.AI_FAKE_MODE = mode
  const result = await generateAdvice(facts)
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.model).toBe('fake')
  const review = validateAdvice(result.output, facts)
  expect(review.items).toHaveLength(valid)
  expect(review.rejected).toBe(rejected)
  if (mode === 'ok')
    expect(review.items[0]?.body).toContain(`{{${id}.net_sales}}`)
})

it('fake simula el rechazo y requiere hechos', async () => {
  env.AI_DRIVER = 'fake'
  env.AI_FAKE_MODE = 'refusal'
  await expect(generateAdvice(facts)).resolves.toEqual({
    ok: false,
    error: 'refusal',
  })
  await expect(generateAdvice([])).resolves.toEqual({
    ok: false,
    error: 'invalid_output',
  })
})

it('envía la petición tipada y devuelve el modelo y uso efectivos', async () => {
  const { client, create } = mockClient()
  await expect(generateAdvice(facts, client)).resolves.toEqual({
    ok: true,
    output,
    model: 'modelo-efectivo',
    usage: { input: 31, output: 12 },
  })
  expect(create).toHaveBeenCalledExactlyOnceWith({
    model: 'modelo-de-prueba',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'medium',
      format: {
        type: 'json_schema',
        schema: expect.objectContaining({
          type: 'object',
          additionalProperties: false,
          required: ['items'],
          properties: {
            items: expect.objectContaining({ type: 'array', minItems: 1 }),
          },
        }),
      },
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
})

it.each(['refusal', 'max_tokens'] as const)(
  'respeta %s antes de leer el contenido',
  async (stop_reason) => {
    const { client, create, response } = mockClient()
    create.mockResolvedValue({
      ...response,
      stop_reason,
      get content(): never {
        throw new Error('Contenido leído')
      },
    })
    await expect(generateAdvice(facts, client)).resolves.toEqual({
      ok: false,
      error: stop_reason,
    })
  },
)

it.each(['{', '{"items":[]}', '{"items":[],"extra":true}'])(
  'rechaza salida inválida %#',
  async (body) => {
    const { client, create, response } = mockClient()
    create.mockResolvedValue({ ...response, content: [text(body)] })
    await expect(generateAdvice(facts, client)).resolves.toEqual({
      ok: false,
      error: 'invalid_output',
    })
  },
)

it('de un APIError solo registra el status', async () => {
  const { client, create } = mockClient()
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  create.mockRejectedValue(
    new Anthropic.APIError(
      429,
      { secret: 'oculto' },
      'texto sensible',
      new Headers(),
    ),
  )
  await expect(generateAdvice(facts, client)).resolves.toEqual({
    ok: false,
    error: 'api_error',
  })
  expect(log).toHaveBeenCalledExactlyOnceWith(429)
})
