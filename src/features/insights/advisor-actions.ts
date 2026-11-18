'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { env } from '@/env'
import { advisorInputHash, loadAdvisorFacts } from '@/lib/server/advisor/facts'
import { requireRole } from '@/lib/server/auth'
import { runPendingJobs } from '@/lib/server/jobs'
import { createClient } from '@/lib/supabase/server'
import { z } from '@/lib/zod'
import { insightEditors } from './queries'
import { insightStatusSchema } from './schemas'

const rpcResult = z.object({
  status: z.enum(['queued', 'running', 'cached', 'limit']),
})

export async function requestAdvice(input: unknown) {
  const parsed = insightStatusSchema.shape.slug.safeParse(input)
  if (!parsed.success) return { status: 'error' } as const
  const slug = parsed.data
  const { organization } = await requireRole(slug, ...insightEditors)
  if (!env.AI_DRIVER) return { status: 'disabled' } as const

  try {
    const db = await createClient()
    const facts = await loadAdvisorFacts(db, organization.id)
    if (!facts.length) return { status: 'no_facts' } as const
    const { data, error } = await db.rpc('request_advisor', {
      p_organization_id: organization.id,
      p_input_hash: advisorInputHash(facts),
    })
    const result = rpcResult.safeParse(data)
    if (error || !result.success) return { status: 'error' } as const
    if (result.data.status === 'queued') after(runPendingJobs)
    revalidatePath(`/o/${slug}/insights`)
    return result.data
  } catch {
    return { status: 'error' } as const
  }
}

export async function submitAdvice(
  _previous: Awaited<ReturnType<typeof requestAdvice>> | null,
  formData: FormData,
) {
  return requestAdvice(formData.get('slug'))
}
