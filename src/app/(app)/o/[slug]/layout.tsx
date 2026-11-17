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
  const { role } = await requireRole(
    slug,
    'owner',
    'admin',
    'analyst',
    'viewer',
  )
  return (
    <>
      <OrganizationNavigation
        slug={slug}
        canManage={role === 'owner' || role === 'admin'}
      />
      <main id="main-content" tabIndex={-1} className="work-content">
        {children}
      </main>
    </>
  )
}
