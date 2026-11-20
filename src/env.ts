import 'server-only'
import { z } from '@/lib/zod'

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

export const serverEnvSchema = z
  .object({
    SUPABASE_SECRET_KEY: z.string().min(1),
    CRON_SECRET: z.string().min(16),
    AI_DRIVER: z.enum(['fake', 'anthropic']).optional(),
    AI_MODEL: z.string().default('claude-opus-5-5'),
    AI_FAKE_MODE: z.enum(['ok', 'invalid', 'refusal']).default('ok'),
    MAIL_DRIVER: z.enum(['mailpit', 'resend']).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    MAIL_FROM: z.string().default('DecisionOS <alertas@decisionos.local>'),
    APP_URL: z.url().default('http://127.0.0.1:3000'),
    MAILPIT_URL: z.url().default('http://127.0.0.1:54324'),
  })
  .superRefine(({ MAIL_DRIVER, RESEND_API_KEY }, ctx) => {
    if (MAIL_DRIVER === 'resend' && !RESEND_API_KEY)
      ctx.addIssue({
        code: 'custom',
        path: ['RESEND_API_KEY'],
        message: 'RESEND_API_KEY es obligatoria con MAIL_DRIVER=resend',
      })
  })

// server-only impide que un import accidental exponga la clave secreta al cliente.
export const env = {
  ...clientEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }),
  ...serverEnvSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    AI_DRIVER: process.env.AI_DRIVER,
    AI_MODEL: process.env.AI_MODEL,
    AI_FAKE_MODE: process.env.AI_FAKE_MODE,
    MAIL_DRIVER: process.env.MAIL_DRIVER,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    MAIL_FROM: process.env.MAIL_FROM,
    APP_URL: process.env.APP_URL,
    MAILPIT_URL: process.env.MAILPIT_URL,
  }),
}

export const isDevelopment = process.env.NODE_ENV === 'development'
