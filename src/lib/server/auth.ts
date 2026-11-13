import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sanitizeNext } from '@/features/auth/schemas'
import type { OrgRole } from '@/lib/supabase/types'
export const getUser = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
})
export const getMembership = cache(async (orgSlug: string) => {
  const user = await getUser()
  if (!user) return null
  const supabase = await createClient()
  const { data: organization, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', orgSlug)
    .maybeSingle()
  if (error) throw new Error('No se pudo consultar la organización.')
  if (!organization) return null
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('role')
    .eq('organization_id', organization.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (membershipError) throw new Error('No se pudo consultar la membresía.')
  return membership ? { organization, role: membership.role } : null
})
export async function requireRole(orgSlug: string, ...roles: OrgRole[]) {
  if (!(await getUser())) {
    const next = sanitizeNext(
      (await headers()).get('x-pathname') ?? '/o/' + orgSlug,
    )
    redirect('/login?next=' + encodeURIComponent(next))
  }
  const membership = await getMembership(orgSlug)
  if (!membership || !roles.includes(membership.role)) redirect('/no-access')
  return membership
}
export async function requireRoleForAction(orgId: string, ...roles: OrgRole[]) {
  const user = await getUser()
  if (!user) return { ok: false, error: 'unauthenticated' } as const
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('memberships')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error || !data || !roles.includes(data.role))
    return { ok: false, error: 'forbidden' } as const
  return { ok: true, data: { user, role: data.role } } as const
}
