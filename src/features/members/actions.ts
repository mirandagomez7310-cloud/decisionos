'use server'
import { refresh } from 'next/cache'
import { requireRoleForAction } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import { memberSchema, memberRoleSchema } from './schemas'
import { mutationError } from './errors'

export async function changeMemberRole(input: unknown) {
  return mutateMember(input, false)
}
export async function removeMember(input: unknown) {
  return mutateMember(input, true)
}
async function mutateMember(input: unknown, remove: boolean) {
  const parsed = (remove ? memberSchema : memberRoleSchema).safeParse(input)
  if (!parsed.success) return { error: 'Solicitud inválida.' }
  try {
    const { organizationId, userId } = parsed.data
    const auth = await requireRoleForAction(organizationId, 'owner', 'admin')
    if (!auth.ok)
      return {
        error:
          auth.error === 'unauthenticated'
            ? mutationError('PGRST301')
            : mutationError('42501'),
      }
    const role = remove ? undefined : memberRoleSchema.parse(input).role
    if (role === 'owner' && auth.data.role !== 'owner')
      return { error: mutationError('42501') }
    const db = await createClient()
    const query = remove
      ? db.from('memberships').delete()
      : db.from('memberships').update({ role })
    const { data, error } = await query
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .select('user_id')
    if (error || !data?.length)
      return { error: mutationError(error?.code ?? '42501') }
    const { error: auditError } = await db
      .from('audit_log')
      .insert({
        organization_id: organizationId,
        actor_user_id: auth.data.user.id,
        actor_kind: 'user',
        action: remove ? 'members.removed' : 'members.role_changed',
        entity: 'memberships',
        entity_id: userId,
      })
    refresh()
    if (auditError)
      return {
        error: 'Cambio guardado, pero no pudimos registrar la auditoría.',
      }
    return { ok: true }
  } catch {
    return { error: mutationError() }
  }
}
