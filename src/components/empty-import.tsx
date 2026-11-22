import Link from 'next/link'
import type { ReactNode } from 'react'
import { FileUp } from 'lucide-react'
import type { OrgRole } from '@/lib/supabase/types'

export function EmptyImport({
  slug,
  role,
  title,
  label,
  subject,
  children,
}: {
  slug: string
  role: OrgRole
  title: string
  label: string
  subject: string
  children: ReactNode
}) {
  return (
    <section className="dashboard-empty card">
      <span className="empty-glyph" aria-hidden="true">
        <FileUp />
      </span>
      <h2>{title}</h2>
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
