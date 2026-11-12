'use client'
import type { OrgRole } from '@/lib/supabase/types'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
export function RoleSelect({
  value,
  onChange,
  owner,
  label,
  disabled,
}: {
  value: OrgRole
  onChange: (role: OrgRole) => void
  owner: boolean
  label: string
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(['owner', 'admin', 'analyst', 'viewer'] as const)
          .filter((role) => owner || role !== 'owner')
          .map((role) => (
            <SelectItem key={role} value={role}>
              {role}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )
}
