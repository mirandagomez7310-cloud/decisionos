'use server'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import { organizationSchema } from './schemas'
export async function createOrganization(input: unknown) {
  const parsed = organizationSchema.safeParse(input)
  if (!parsed.success)
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    } as const
  let slug: string
  try {
    // Todavía no existe una membresía: la RPC crea organización y owner de forma atómica.
    if (!(await getUser()))
      return { ok: false, error: 'unauthenticated' } as const
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(
      'create_organization',
      parsed.data,
    )
    if (error?.code === '23505')
      return {
        ok: false,
        fieldErrors: {
          name: undefined,
          slug: ['Este identificador ya está en uso.'],
        },
      } as const
    if (error?.code === '42501' || error?.code === 'PGRST301')
      return { ok: false, error: 'unauthenticated' } as const
    if (error || !data)
      return {
        ok: false,
        error: 'No pudimos crear la organización. Inténtalo de nuevo.',
      } as const
    slug = data.slug
  } catch {
    return {
      ok: false,
      error: 'No pudimos conectar. Inténtalo de nuevo.',
    } as const
  }
  redirect('/o/' + slug)
}
