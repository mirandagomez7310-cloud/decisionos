import 'server-only'
import { z } from '@/lib/zod'

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

export const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  JOBS_SECRET: z.string().min(1),
  AI_DRIVER: z.enum(['fake', 'anthropic']).optional(),
  AI_MODEL: z.string().default('claude-opus-5-5'),
  AI_FAKE_MODE: z.enum(['ok', 'invalid', 'refusal']).default('ok'),
  MAIL_DRIVER: z.enum(['mailpit']).optional(),
  MAIL_FROM: z.string().default('DecisionOS <alertas@decisionos.local>'),
  APP_URL: z.url().default('http://127.0.0.1:3000'),
  MAILPIT_URL: z.url().default('http://127.0.0.1:54324'),
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
    JOBS_SECRET: process.env.JOBS_SECRET,
    AI_DRIVER: process.env.AI_DRIVER,
    AI_MODEL: process.env.AI_MODEL,
    AI_FAKE_MODE: process.env.AI_FAKE_MODE,
    MAIL_DRIVER: process.env.MAIL_DRIVER,
    MAIL_FROM: process.env.MAIL_FROM,
    APP_URL: process.env.APP_URL,
    MAILPIT_URL: process.env.MAILPIT_URL,
  }),
}

export const isDevelopment = process.env.NODE_ENV === 'development'
