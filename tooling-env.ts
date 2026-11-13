import { z } from 'zod'
// Herramientas Node sin server-only: no se importa este archivo desde la aplicación.
export const toolingEnv = {
  get url() {
    return z.url().parse(process.env.NEXT_PUBLIC_SUPABASE_URL)
  },
  get key() {
    return z
      .string()
      .min(1)
      .parse(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  },
  get secret() {
    return z.string().min(1).parse(process.env.SUPABASE_SECRET_KEY)
  },
}
