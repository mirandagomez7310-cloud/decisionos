import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { InvitationForm } from './invitation-form'
vi.mock('../actions', () => ({ createInvitation: vi.fn() }))
import { createInvitation } from '../actions'
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('un admin no ofrece owner y muestra el error de correo del servidor', async () => {
  vi.mocked(createInvitation).mockResolvedValue({
    fieldErrors: {
      email: ['Ya hay una invitación pendiente para este correo.'],
    },
  })
  const user = userEvent.setup()
  render(<InvitationForm organizationId="org" owner={false} />)
  expect(
    screen.queryByRole('option', { name: 'owner' }),
  ).not.toBeInTheDocument()
  await user.type(
    screen.getByLabelText('Correo de invitación'),
    'new@example.com',
  )
  await user.click(screen.getByRole('button', { name: 'Invitar' }))
  await waitFor(() =>
    expect(createInvitation).toHaveBeenCalledWith({
      organizationId: 'org',
      email: 'new@example.com',
      role: 'viewer',
    }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Ya hay una invitación',
  )
  expect(screen.getByLabelText('Correo de invitación')).toHaveAttribute(
    'aria-invalid',
    'true',
  )
})

it('conserva el enlace tras refrescar el historial y permite copiarlo', async () => {
  vi.mocked(createInvitation).mockResolvedValue({
    url: '/invitations/token',
    invitationId: 'id',
  })
  const user = userEvent.setup()
  const view = render(<InvitationForm organizationId="org" owner />)
  await user.type(
    screen.getByLabelText('Correo de invitación'),
    'new@example.com',
  )
  await user.click(screen.getByRole('button', { name: 'Invitar' }))
  expect(
    await screen.findByLabelText('Enlace de invitación'),
  ).toHaveTextContent('/invitations/token')
  view.rerender(<InvitationForm organizationId="org" owner />)
  const writeText = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockResolvedValue()
  await user.click(screen.getByRole('button', { name: 'Copiar enlace' }))
  expect(writeText).toHaveBeenCalledWith(
    new URL('/invitations/token', window.location.origin).href,
  )
  expect(await screen.findByText('Enlace copiado.')).toBeVisible()
})
