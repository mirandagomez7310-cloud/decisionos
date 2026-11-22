import { getUser } from '@/features/auth/queries'
import { LogoutButton } from '@/features/auth/components/logout-button'

/** Barra superior de las páginas sin organización (invitaciones, sin acceso, nueva organización). */
export async function AppTopBar() {
  const user = await getUser()
  return (
    <header className="app-header material">
      <span className="wordmark">DecisionOS</span>
      <div className="app-account">
        <span>{user?.email}</span>
        <LogoutButton />
      </div>
    </header>
  )
}

export async function SidebarAccount() {
  const user = await getUser()
  return (
    <div className="sidebar-account">
      <p>{user?.email}</p>
      <LogoutButton />
    </div>
  )
}
