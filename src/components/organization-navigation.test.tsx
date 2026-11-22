import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrganizationNavigation } from './organization-navigation'
const route = vi.hoisted(() => ({ pathname: '/o/demo/catalog/customers' }))
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }))
afterEach(cleanup)
/** Enlace siguiente en el orden de lectura de la navegación. */
function after(name: string) {
  const links = screen.getAllByRole('link')
  return links[links.indexOf(screen.getByRole('link', { name })) + 1]
}
it('muestra Diagnóstico después de Inicio con el total y la ruta activa', () => {
  route.pathname = '/o/demo/insights'
  const { rerender } = render(
    <OrganizationNavigation slug="demo" canManage={false} newInsights={3} />,
  )
  const insights = screen.getByRole('link', { name: 'Diagnóstico 3' })
  expect(after('Inicio')).toBe(insights)
  expect(insights).toHaveAttribute('href', '/o/demo/insights')
  expect(insights).toHaveAttribute('aria-current', 'page')
  rerender(
    <OrganizationNavigation slug="demo" canManage={false} newInsights={0} />,
  )
  expect(insights).toHaveAccessibleName('Diagnóstico')
  rerender(
    <OrganizationNavigation slug="demo" canManage={false} newInsights={150} />,
  )
  expect(insights).toHaveAccessibleName('Diagnóstico 99+')
})

describe('navegación de organización', () => {
  it('marca el módulo activo incluso en sus rutas hijas y al navegar', () => {
    route.pathname = '/o/demo/catalog/customers'
    const { rerender } = render(
      <OrganizationNavigation slug="demo" canManage={false} />,
    )
    expect(screen.getByRole('link', { name: 'Catálogo' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute(
      'aria-current',
    )
    expect(
      screen.queryByRole('link', { name: 'Miembros' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Auditoría' }),
    ).not.toBeInTheDocument()
    route.pathname = '/o/demo/sales'
    rerender(<OrganizationNavigation slug="demo" canManage={true} />)
    expect(screen.getByRole('link', { name: 'Ventas' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Catálogo' })).not.toHaveAttribute(
      'aria-current',
    )
    expect(screen.getByRole('link', { name: 'Miembros' })).toHaveAttribute(
      'href',
      '/o/demo/settings/members',
    )
    expect(screen.getByRole('link', { name: 'Auditoría' })).toBeInTheDocument()
    expect(after('Margen')).toBe(
      screen.getByRole('link', { name: 'Inventario' }),
    )
    route.pathname = '/o/demo/inventory'
    rerender(<OrganizationNavigation slug="demo" canManage={false} />)
    expect(screen.getByRole('link', { name: 'Inventario' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const receivables = screen.getByRole('link', { name: 'Cobranza' })
    expect(after('Inventario')).toBe(receivables)
    expect(receivables).toHaveAttribute('href', '/o/demo/receivables')
    route.pathname = '/o/demo/receivables'
    rerender(<OrganizationNavigation slug="demo" canManage={false} />)
    expect(receivables).toHaveAttribute('aria-current', 'page')
  })
})
