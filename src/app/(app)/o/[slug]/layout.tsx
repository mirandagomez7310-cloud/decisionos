import Link from 'next/link'
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
      <nav aria-label="Organización" className="mb-6 flex gap-4">
        <Link className="underline" href={'/o/' + slug}>
          Inicio
        </Link>
        {(role === 'owner' || role === 'admin') && (
          <Link className="underline" href={'/o/' + slug + '/members'}>
            Miembros
          </Link>
        )}
      </nav>
      {children}
    </>
  )
}
