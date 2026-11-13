import 'server-only'
import { z } from '@/lib/zod'

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

export const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  JOBS_SECRET: z.string().min(1),
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
  }),
}

export const isDevelopment = process.env.NODE_ENV === 'development'
