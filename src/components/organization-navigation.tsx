'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import {
  Activity,
  BookOpen,
  ChartLine,
  Ellipsis,
  FileUp,
  History,
  House,
  Package,
  Percent,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

type Item = { label: string; href: string; section: string; icon: LucideIcon; tone: string }

function items(canManage: boolean) {
  const groups: [string, Item[]][] = [
    [
      'Resumen',
      [
        { label: 'Inicio', href: '', section: '', icon: House, tone: '--m-home' },
        { label: 'Diagnóstico', href: '/insights', section: '/insights', icon: Activity, tone: '--m-insights' },
      ],
    ],
    [
      'Análisis',
      [
        { label: 'Ventas', href: '/sales', section: '/sales', icon: ChartLine, tone: '--m-sales' },
        { label: 'Margen', href: '/margin', section: '/margin', icon: Percent, tone: '--m-margin' },
        { label: 'Inventario', href: '/inventory', section: '/inventory', icon: Package, tone: '--m-inventory' },
        { label: 'Cobranza', href: '/receivables', section: '/receivables', icon: Wallet, tone: '--m-receivables' },
      ],
    ],
    [
      'Datos',
      [
        { label: 'Importaciones', href: '/imports', section: '/imports', icon: FileUp, tone: '--m-data' },
        { label: 'Catálogo', href: '/catalog/products', section: '/catalog', icon: BookOpen, tone: '--m-data' },
      ],
    ],
  ]
  if (canManage)
    groups.push([
      'Administración',
      [
        { label: 'Miembros', href: '/settings/members', section: '/settings/members', icon: Users, tone: '--m-admin' },
        { label: 'Auditoría', href: '/settings/audit', section: '/settings/audit', icon: History, tone: '--m-admin' },
      ],
    ])
  return groups
}

function useCurrent(slug: string) {
  const pathname = usePathname()
  const base = '/o/' + slug
  return (section: string) =>
    (
      section
        ? pathname === base + section || pathname.startsWith(base + section + '/')
        : pathname === base
    )
      ? ('page' as const)
      : undefined
}

function Badge({ count }: { count: number }) {
  // El espacio mantiene el nombre accesible «Diagnóstico 3».
  return count > 0 ? (
    <>
      {' '}
      <span className="nav-badge">{count > 99 ? '99+' : count}</span>
    </>
  ) : null
}

/** Barra lateral (escritorio) y contenido de la hoja «Más» (móvil). */
export function OrganizationNavigation({
  slug,
  canManage,
  newInsights = 0,
}: {
  slug: string
  canManage: boolean
  newInsights?: number
}) {
  const current = useCurrent(slug)
  const base = '/o/' + slug
  return (
    <nav aria-label="Organización" className="organization-nav">
      {items(canManage).map(([heading, links]) => (
        <div key={heading} className="nav-group">
          <h2 className="nav-heading">{heading}</h2>
          <ul>
            {links.map(({ label, href, section, icon: Icon, tone }) => (
              <li key={href}>
                <Link
                  className="nav-link"
                  href={base + href}
                  aria-current={current(section)}
                  style={{ '--tone': `var(${tone})` } as React.CSSProperties}
                >
                  <Icon aria-hidden="true" />
                  {label}
                  {section === '/insights' && <Badge count={newInsights} />}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** Barra de pestañas de iOS: cuatro destinos frecuentes y «Más» con el resto, la cuenta y salir. */
export function MobileTabBar({
  slug,
  newInsights = 0,
  children,
}: {
  slug: string
  newInsights?: number
  children: React.ReactNode
}) {
  const current = useCurrent(slug)
  const pathname = usePathname()
  const sheet = useRef<HTMLDialogElement>(null)
  useEffect(() => sheet.current?.close(), [pathname])
  const base = '/o/' + slug
  const tabs = items(false).flatMap(([, links]) => links).slice(0, 4)
  return (
    <>
      <nav aria-label="Principal" className="tabbar material">
        {tabs.map(({ label, href, section, icon: Icon }) => (
          <Link key={href} href={base + href} aria-current={current(section)}>
            <Icon aria-hidden="true" />
            {label}
            {section === '/insights' && <Badge count={newInsights} />}
          </Link>
        ))}
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => sheet.current?.showModal()}
        >
          <Ellipsis aria-hidden="true" />
          Más
        </button>
      </nav>
      <dialog
        ref={sheet}
        className="more-sheet"
        aria-labelledby="more-sheet-title"
        // Cierra al tocar fuera donde el navegador lo admite; si no, Escape y «Listo».
        {...{ closedby: 'any' }}
      >
        <div className="more-sheet-head material">
          <h2 id="more-sheet-title">Más</h2>
          <button type="button" onClick={() => sheet.current?.close()}>
            Listo
          </button>
        </div>
        {children}
      </dialog>
    </>
  )
}
