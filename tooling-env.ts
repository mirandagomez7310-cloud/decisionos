import { z } from 'zod'
// Herramientas Node sin server-only: no se importa este archivo desde la aplicación.
export const toolingEnv = {
  get mailpitUrl() {
    return z
      .url()
      .default('http://127.0.0.1:54324')
      .parse(process.env.MAILPIT_URL)
  },
  get appUrl() {
    return z.url().default('http://127.0.0.1:3000').parse(process.env.APP_URL)
  },
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
