import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/server/auth'
export { requireRole } from '@/lib/server/auth'
export async function getFirstOrganization() {
  const user = await getUser()
  if (!user) return null
  const supabase = await createClient()
  const { data: membership, error } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .order('created_at')
    .order('organization_id')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error('No se pudieron consultar tus organizaciones.')
  if (!membership) return null
  const { data, error: organizationError } = await supabase
    .from('organizations')
    .select('slug')
    .eq('id', membership.organization_id)
    .maybeSingle()
  if (organizationError)
    throw new Error('No se pudo consultar la organización.')
  return data
}
