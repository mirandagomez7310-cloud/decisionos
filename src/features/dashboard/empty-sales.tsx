import { EmptyImport } from '@/components/empty-import'
import type { OrgRole } from '@/lib/supabase/types'

export function EmptySales({ slug, role }: { slug: string; role: OrgRole }) {
  return (
    <EmptyImport
      slug={slug}
      role={role}
      label="Importar ventas"
      subject="las ventas"
    >
      Importa ventas en CSV o Excel con folio, fecha, cliente, producto,
      cantidad y precio. El costo es opcional y permite calcular el margen.
    </EmptyImport>
  )
}
