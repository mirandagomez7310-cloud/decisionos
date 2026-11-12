import type { ComponentProps } from 'react'

export function RoleSelect({
  owner,
  label,
  ...props
}: ComponentProps<'select'> & {
  owner: boolean
  label: string
}) {
  return (
    <select
      {...props}
      aria-label={label}
      className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
    >
      {(['owner', 'admin', 'analyst', 'viewer'] as const)
        .filter((role) => owner || role !== 'owner')
        .map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
    </select>
  )
}
