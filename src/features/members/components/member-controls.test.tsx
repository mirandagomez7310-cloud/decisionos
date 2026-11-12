import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { MemberControls } from './member-controls'

vi.mock('../actions', () => ({
  changeMemberRole: vi.fn(),
  removeMember: vi.fn(),
}))
import { changeMemberRole, removeMember } from '../actions'
const props = {
  organizationId: 'org',
  userId: 'user',
  email: 'member@example.com',
  role: 'analyst' as const,
  owner: true,
}
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it('envía el rol nativo y muestra el rechazo del servidor', async () => {
  vi.mocked(changeMemberRole).mockResolvedValue({ error: 'Sin permiso' })
  const user = userEvent.setup()
  render(<MemberControls {...props} />)
  await user.selectOptions(
    screen.getByLabelText('Rol de ' + props.email),
    'viewer',
  )
  await user.click(screen.getByRole('button', { name: 'Guardar rol' }))
  await waitFor(() =>
    expect(changeMemberRole).toHaveBeenCalledWith({
      organizationId: 'org',
      userId: 'user',
      role: 'viewer',
    }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin permiso')
  expect(removeMember).not.toHaveBeenCalled()
})

it('carga la confirmación solo al abrir y no elimina al cancelar', async () => {
  const user = userEvent.setup()
  render(<MemberControls {...props} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Quitar miembro' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(removeMember).not.toHaveBeenCalled()
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Quitar miembro' }),
    ).toHaveFocus(),
  )
})

it('confirma la baja y conserva el error dentro del diálogo', async () => {
  vi.mocked(removeMember).mockResolvedValue({
    error: 'La organización necesita al menos un propietario',
  })
  const user = userEvent.setup()
  render(<MemberControls {...props} />)
  await user.click(screen.getByRole('button', { name: 'Quitar miembro' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(
    within(dialog).getByRole('button', { name: 'Confirmar baja' }),
  )
  await waitFor(() =>
    expect(removeMember).toHaveBeenCalledWith({
      organizationId: 'org',
      userId: 'user',
    }),
  )
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'al menos un propietario',
  )
  expect(changeMemberRole).not.toHaveBeenCalled()
})
