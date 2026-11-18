import { countInsights } from '@/features/insights/queries'
import { createClient } from '@/lib/supabase/server'
import { OrganizationNavigation } from '@/components/organization-navigation'
import { requireRole } from '@/features/organizations/queries'
export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const { role, organization } = await requireRole(
    slug,
    'owner',
    'admin',
    'analyst',
    'viewer',
  )
  const { count } = await countInsights(
    await createClient(),
    organization.id,
    'new',
  )
  return (
    <>
      <OrganizationNavigation
        slug={slug}
        newInsights={count ?? 0}
        canManage={role === 'owner' || role === 'admin'}
      />
      <main id="main-content" tabIndex={-1} className="work-content">
        {children}
      </main>
    </>
  )
}
