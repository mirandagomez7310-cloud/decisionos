'use server'
import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { getUser, requireRoleForAction } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import { mutationError } from '@/features/members/errors'
import { invitationSchema, revokeSchema, tokenSchema } from './schemas'
import { generateInvitationToken } from './token'

export async function createInvitation(input: unknown) {
  const parsed = invitationSchema.safeParse(input)
  if (!parsed.success)
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  try {
    const { organizationId, email, role } = parsed.data
    const auth = await requireRoleForAction(organizationId, 'owner', 'admin')
    if (!auth.ok)
      return {
        error: mutationError(
          auth.error === 'unauthenticated' ? 'PGRST301' : '42501',
        ),
      }
    if (role === 'owner' && auth.data.role !== 'owner')
      return { error: mutationError('42501') }
    const db = await createClient()
    const { token, hash } = await generateInvitationToken()
    const { data, error } = await db
      .from('invitations')
      .insert({
        organization_id: organizationId,
        email,
        role,
        token_hash: hash,
        created_by: auth.data.user.id,
      })
      .select('id')
      .single()
    if (error?.code === '23505')
      return {
        fieldErrors: {
          email: ['Ya hay una invitación pendiente para este correo.'],
        },
      }
    if (error || !data) return { error: mutationError(error?.code) }
    const { error: auditError } = await db
      .from('audit_log')
      .insert({
        organization_id: organizationId,
        actor_user_id: auth.data.user.id,
        actor_kind: 'user',
        action: 'invitations.created',
        entity: 'invitations',
        entity_id: data.id,
      })
    refresh()
    return {
      url: '/invitations/' + token,
      invitationId: data.id,
      ...(auditError
        ? {
            error: 'Invitación creada, pero no pudimos registrar la auditoría.',
          }
        : {}),
    }
  } catch {
    return { error: mutationError() }
  }
}
export async function revokeInvitation(input: unknown) {
  const parsed = revokeSchema.safeParse(input)
  if (!parsed.success) return { error: 'Solicitud inválida.' }
  try {
    const { organizationId, invitationId } = parsed.data
    const auth = await requireRoleForAction(organizationId, 'owner', 'admin')
    if (!auth.ok)
      return {
        error: mutationError(
          auth.error === 'unauthenticated' ? 'PGRST301' : '42501',
        ),
      }
    const db = await createClient()
    const { data, error } = await db
      .from('invitations')
      .delete()
      .eq('organization_id', organizationId)
      .eq('id', invitationId)
      .is('accepted_at', null)
      .select('id')
    if (error || !data?.length)
      return { error: mutationError(error?.code ?? '42501') }
    const { error: auditError } = await db
      .from('audit_log')
      .insert({
        organization_id: organizationId,
        actor_user_id: auth.data.user.id,
        actor_kind: 'user',
        action: 'invitations.revoked',
        entity: 'invitations',
        entity_id: invitationId,
      })
    refresh()
    return auditError
      ? {
          error: 'Invitación revocada, pero no pudimos registrar la auditoría.',
        }
      : { ok: true }
  } catch {
    return { error: mutationError() }
  }
}
export async function acceptInvitation(input: unknown) {
  const invalid = { error: 'Invitación inválida, caducada o para otro correo' }
  const parsed = tokenSchema.safeParse(input)
  if (!parsed.success) return invalid
  let slug: string
  try {
    if (!(await getUser())) return { error: mutationError('PGRST301') }
    const db = await createClient()
    const { data, error } = await db.rpc('accept_invitation', {
      token: parsed.data,
    })
    if (error || !data) return invalid
    const { data: org } = await db
      .from('organizations')
      .select('slug')
      .eq('id', data)
      .single()
    if (!org) return invalid
    slug = org.slug
  } catch {
    return invalid
  }
  redirect('/o/' + slug)
}
