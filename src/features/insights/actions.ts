'use server'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import { insightEditors } from './queries'
import { insightStatusSchema } from './schemas'

export async function setInsightStatus(formData: FormData) {
  const parsed = insightStatusSchema.safeParse({
    slug: formData.get('slug'),
    id: formData.get('id'),
    status: formData.get('status'),
  })
  if (!parsed.success) return { error: 'Solicitud inválida.' }

  const { slug, id, status } = parsed.data
  const failure = {
    error: 'No pudimos cambiar el estado. Vuelve a intentarlo.',
  }
  // Fuera del try: requireRole redirige al login lanzando, y eso no se traga.
  await requireRole(slug, ...insightEditors)
  try {
    const db = await createClient()
    const { error } = await db.rpc('set_insight_status', {
      p_insight_id: id,
      p_status: status,
    })
    if (error) return failure
    revalidatePath(`/o/${slug}/insights`)
    revalidatePath(`/o/${slug}`)
    return { error: '' }
  } catch {
    return failure
  }
}

export async function submitInsightStatus(
  _previous: { error: string },
  formData: FormData,
) {
  return setInsightStatus(formData)
}
