import { z } from '@/lib/zod'

export const adviceSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        kind: z.enum(['hypothesis', 'suggestion']),
        priority: z.number().int().min(1).max(5),
        title: z.string().min(1).max(120),
        body: z.string().min(1).max(600),
        cites: z.array(z.string()).min(1).max(5),
      }),
    )
    .min(1)
    .max(5),
})

export type AdviceOutput = z.infer<typeof adviceSchema>
export type AdviceItem = AdviceOutput['items'][number]

export const adviceJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'priority', 'title', 'body', 'cites'],
        properties: {
          kind: { type: 'string', enum: ['hypothesis', 'suggestion'] },
          priority: { type: 'integer', minimum: 1, maximum: 5 },
          title: { type: 'string', minLength: 1, maxLength: 120 },
          body: { type: 'string', minLength: 1, maxLength: 600 },
          cites: {
            type: 'array',
            minItems: 1,
            maxItems: 5,
            items: { type: 'string' },
          },
        },
      },
    },
  },
} as const
