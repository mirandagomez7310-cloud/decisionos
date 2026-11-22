import { countInsights } from '@/features/insights/queries'
import { createClient } from '@/lib/supabase/server'
import {
  MobileTabBar,
  OrganizationNavigation,
} from '@/components/organization-navigation'
import { SidebarAccount } from '@/components/app-account'
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
  const navProps = {
    slug,
    newInsights: count ?? 0,
    canManage: role === 'owner' || role === 'admin',
  }
  return (
    <div className="app-frame">
      <aside className="app-sidebar material">
        <div className="sidebar-head">
          <span className="wordmark">DecisionOS</span>
          <span className="sidebar-org">{organization.name}</span>
        </div>
        <OrganizationNavigation {...navProps} />
        <SidebarAccount />
      </aside>
      <main id="main-content" tabIndex={-1} className="work-content">
        {children}
      </main>
      <MobileTabBar
        slug={slug}
        organization={organization.name}
        newInsights={count ?? 0}
      >
        {/* Las cuatro primeras secciones ya están en la barra de pestañas. */}
        <OrganizationNavigation
          {...navProps}
          omit={['', '/insights', '/sales', '/margin']}
        />
        <SidebarAccount />
      </MobileTabBar>
    </div>
  )
}
