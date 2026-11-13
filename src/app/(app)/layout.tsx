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
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <span className="break-all">{user.email}</span>
        <LogoutButton />
      </header>
      {children}
    </>
  )
}
