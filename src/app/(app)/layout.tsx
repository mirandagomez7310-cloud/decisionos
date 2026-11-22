import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getUser } from '@/features/auth/queries'
import { sanitizeNext } from '@/features/auth/schemas'
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
  return children
}
