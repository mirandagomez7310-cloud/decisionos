import { redirect } from 'next/navigation'
import { env } from '@/env'
import { confirmRedirect } from '@/features/auth/schemas'
import { createClient } from '@/lib/supabase/server'
import { z } from '@/lib/zod'

const confirmationSchema = z.object({
  token_hash: z.string().min(1).max(512),
  type: z.literal('email'),
})
const errorPath = '/login?error=confirmation'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = confirmationSchema.safeParse({
    token_hash: searchParams.get('token_hash'),
    type: searchParams.get('type'),
  })
  if (!parsed.success) redirect(errorPath)

  let destination = errorPath
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp(parsed.data)
    if (!error)
      destination = confirmRedirect(searchParams.get('next'), env.APP_URL)
  } catch {
    redirect(errorPath)
  }
  redirect(destination)
}
