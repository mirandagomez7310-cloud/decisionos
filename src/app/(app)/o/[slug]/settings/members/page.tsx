import {
  AnalysisHeading,
  AnalysisPagination,
  QueryAlert,
  SortHeader,
} from '@/features/analysis/components'
import { requireRole } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { membersSearchSchema } from '@/features/members/schemas'
import {
  MembersTable,
  type MemberRow,
} from '@/components/data-table/members-table'
import { InvitationsPanel } from '@/features/invitations/components/invitations-panel'
export default async function MembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const { organization, role } = await requireRole(slug, 'owner', 'admin')
  const parsed = membersSearchSchema.safeParse(await searchParams)
  if (!parsed.success)
    return (
      <>
        <AnalysisHeading title="Miembros" />
        <QueryAlert
          href={'/o/' + slug + '/settings/members'}
          label="Restablecer consulta"
        >
          Parámetros de consulta inválidos.
        </QueryAlert>
      </>
    )
  const { page, pageSize, sort } = parsed.data
  const db = await createClient()
  const admin = createAdminClient()
  const rows: MemberRow[] = []
  // shortcut: ordenar por correo consulta Auth por miembro; usar una proyección SQL protegida al crecer el tenant.
  // Los correos de Auth solo se consultan para IDs autorizados por RLS de esta organización.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db
      .from('memberships')
      .select('user_id,organization_id,role,created_at')
      .eq('organization_id', organization.id)
      .order('user_id')
      .range(offset, offset + 999)
    if (error) throw new Error('No pudimos consultar los miembros.')
    rows.push(
      ...(await Promise.all(
        data.map(async (member) => {
          const { data: account, error: accountError } =
            await admin.auth.admin.getUserById(member.user_id)
          if (accountError || !account.user.email)
            throw new Error('No pudimos consultar los correos.')
          return {
            ...member,
            email: account.user.email,
            owner: role === 'owner',
          }
        }),
      )),
    )
    if (data.length < 1000) break
  }
  const field = sort.replace('-', '') as 'email' | 'role' | 'created_at'
  rows.sort(
    (a, b) =>
      (a[field].localeCompare(b[field]) || a.user_id.localeCompare(b.user_id)) *
      (sort.startsWith('-') ? -1 : 1),
  )
  const { data: invitations, error } = await db
    .from('invitations')
    .select('id,email,role,expires_at')
    .eq('organization_id', organization.id)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error('No pudimos consultar las invitaciones.')
  const href = (nextPage: number, nextSort = sort, nextSize = pageSize) =>
    '?' +
    new URLSearchParams({
      page: String(nextPage),
      pageSize: String(nextSize),
      sort: nextSort,
    })
  const header = (label: string, key: typeof field) => (
    <SortHeader
      label={label}
      href={href(1, sort === key ? `-${key}` : key)}
      direction={
        field === key
          ? sort.startsWith('-')
            ? 'descending'
            : 'ascending'
          : undefined
      }
    />
  )
  return (
    <>
      <AnalysisHeading title="Miembros">
        {rows.length} {rows.length === 1 ? 'persona tiene' : 'personas tienen'}{' '}
        acceso a {organization.name}
      </AnalysisHeading>
      {rows.length ? (
        <MembersTable
          data={rows.slice((page - 1) * pageSize, page * pageSize)}
          head={
            <>
              {header('Correo', 'email')}
              {header('Rol', 'role')}
              {header('Fecha de alta', 'created_at')}
            </>
          }
        />
      ) : (
        <p>Aún no hay miembros</p>
      )}
      {rows.length > pageSize && (
        <AnalysisPagination
          page={page}
          pages={Math.ceil(rows.length / pageSize)}
          count={rows.length}
          href={(next) => href(next)}
        />
      )}
      <InvitationsPanel
        organizationId={organization.id}
        owner={role === 'owner'}
        invitations={invitations}
      />
    </>
  )
}
