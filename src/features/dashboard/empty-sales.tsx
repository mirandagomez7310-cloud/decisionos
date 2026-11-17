import Link from 'next/link'
import type { OrgRole } from '@/lib/supabase/types'

export function EmptySales({ slug, role }: { slug: string; role: OrgRole }) {
  return (
    <section className="dashboard-empty">
      <h2>Aún no hay datos</h2>
      <p>
        Importa ventas en CSV o Excel con folio, fecha, cliente, producto,
        cantidad y precio. El costo es opcional y permite calcular el margen.
      </p>
      {role === 'owner' || role === 'admin' ? (
        <Link className="action-button" href={`/o/${slug}/imports/new`}>
          Importar ventas
        </Link>
      ) : (
        <p>Pide a un propietario o administrador que importe las ventas.</p>
      )}
    </section>
  )
}
