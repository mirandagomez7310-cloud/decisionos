import type { ComponentProps } from 'react'
import { roleLabels } from '../schemas'

export function RoleSelect({
  owner,
  label,
  ...props
}: ComponentProps<'select'> & {
  owner: boolean
  label: string
}) {
  return (
    <select {...props} aria-label={label}>
      {(['owner', 'admin', 'analyst', 'viewer'] as const)
        .filter((role) => owner || role !== 'owner')
        .map((role) => (
          <option key={role} value={role}>
            {roleLabels[role]}
          </option>
        ))}
    </select>
  )
}
