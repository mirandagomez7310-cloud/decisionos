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
  omit = [],
}: {
  slug: string
  canManage: boolean
  newInsights?: number
  /** Secciones que ya están en la barra de pestañas. */
  omit?: string[]
}) {
  const current = useCurrent(slug)
  const base = '/o/' + slug
  const groups = items(canManage)
    .map(([heading, links]) => [heading, links.filter((link) => !omit.includes(link.section))] as const)
    .filter(([, links]) => links.length)
  return (
    <nav aria-label="Organización" className="organization-nav">
      {groups.map(([heading, links]) => (
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
  organization,
  newInsights = 0,
  children,
}: {
  slug: string
  organization: string
  newInsights?: number
  children: React.ReactNode
}) {
  const current = useCurrent(slug)
  const pathname = usePathname()
  const sheet = useRef<HTMLDialogElement>(null)
  useEffect(() => sheet.current?.close(), [pathname])
  // Cierra también al tocar el enlace de la página actual, que no cambia la ruta.
  useEffect(() => {
    const dialog = sheet.current
    const close = (event: MouseEvent) => {
      if ((event.target as Element).closest('a')) dialog?.close()
    }
    dialog?.addEventListener('click', close)
    return () => dialog?.removeEventListener('click', close)
  }, [])
  const base = '/o/' + slug
  const tabs = items(false).flatMap(([, links]) => links).slice(0, 4)
  const inMore = !tabs.some(({ section }) => current(section))
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
          data-active={inMore || undefined}
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
          <div>
            <h2 id="more-sheet-title">Más</h2>
            <p className="sidebar-org">{organization}</p>
          </div>
          <button type="button" onClick={() => sheet.current?.close()}>
            Listo
          </button>
        </div>
        {children}
      </dialog>
    </>
  )
}
