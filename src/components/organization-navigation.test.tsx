import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrganizationNavigation } from './organization-navigation'
const route = vi.hoisted(() => ({ pathname: '/o/demo/catalog/customers' }))
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }))
afterEach(cleanup)
describe('navegación de organización', () => {
  it('marca el módulo activo incluso en sus rutas hijas y al navegar', () => {
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
  })
})
