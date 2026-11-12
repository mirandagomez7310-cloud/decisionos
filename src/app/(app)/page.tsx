import { redirect } from 'next/navigation'
import { getUser } from '@/features/auth/queries'
import { getFirstOrganization } from '@/features/organizations/queries'
export default async function Page() {
  if (!(await getUser())) redirect('/login')
  const organization = await getFirstOrganization()
  redirect(organization ? '/o/' + organization.slug : '/organizations/new')
}
