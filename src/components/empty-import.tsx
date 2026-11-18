import Link from 'next/link'
import type { ReactNode } from 'react'
import type { OrgRole } from '@/lib/supabase/types'

export function EmptyImport({
  slug,
  role,
  label,
  subject,
  children,
}: {
  slug: string
  role: OrgRole
  label: string
  subject: string
  children: ReactNode
}) {
  return (
    <section className="dashboard-empty">
      <h2>Aún no hay datos</h2>
      <p>{children}</p>
      {role === 'owner' || role === 'admin' ? (
        <Link className="action-button" href={`/o/${slug}/imports/new`}>
          {label}
        </Link>
      ) : (
        <p>Pide a un propietario o administrador que importe {subject}.</p>
      )}
    </section>
  )
}
