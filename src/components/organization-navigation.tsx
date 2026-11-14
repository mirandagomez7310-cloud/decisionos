'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
export function OrganizationNavigation({
  slug,
  canManage,
}: {
  slug: string
  canManage: boolean
}) {
  const pathname = usePathname()
  const base = '/o/' + slug
  const links = [
    ['Inicio', '', ''],
    ['Ventas', '/sales', '/sales'],
    ['Margen', '/margin', '/margin'],
    ['Importaciones', '/imports', '/imports'],
    ['Catálogo', '/catalog/products', '/catalog'],
    ...(canManage
      ? [
          ['Miembros', '/settings/members', '/settings/members'],
          ['Auditoría', '/settings/audit', '/settings/audit'],
        ]
      : []),
  ]
  return (
    <nav aria-label="Organización" className="organization-nav">
      {links.map(([label, href, section]) => (
        <Link
          key={href}
          href={base + href}
          aria-current={
            (
              section
                ? pathname === base + section ||
                  pathname.startsWith(base + section + '/')
                : pathname === base
            )
              ? 'page'
              : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
