import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getUser } from '@/features/auth/queries'
import { sanitizeNext } from '@/features/auth/schemas'
import { LogoutButton } from '@/features/auth/components/logout-button'
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUser()
  if (!user)
    redirect(
      '/login?next=' +
        encodeURIComponent(sanitizeNext((await headers()).get('x-pathname'))),
    )
  return (
    <>
      <header className="app-header">
        <span className="wordmark">DecisionOS</span>
        <div className="app-account">
          <span>{user.email}</span>
          <LogoutButton />
        </div>
        <details className="mobile-account">
          <summary>Cuenta</summary>
          <div>
            <p>{user.email}</p>
            <LogoutButton />
          </div>
        </details>
      </header>
      {children}
    </>
  )
}
