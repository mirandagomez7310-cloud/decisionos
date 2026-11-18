import Link from 'next/link'
import type { ReactNode } from 'react'

export function AnalysisHeading({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="dashboard-head">
      <div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  )
}

export function QueryAlert({
  children,
  href,
  label,
}: {
  children: ReactNode
  href: string
  label: string
}) {
  return (
    <p role="alert">
      {children}{' '}
      <Link className="underline" href={href}>
        {label}
      </Link>
    </p>
  )
}

export function AnalysisSummary({ children }: { children: ReactNode }) {
  return <p className="analysis-summary">{children}</p>
}

export function AnalysisTable({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  /* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- La región desplazable requiere foco para recorrer la tabla con teclado. */
  return (
    <section className="analysis-scroll" tabIndex={0} aria-label={label}>
      <table className="metrics-table analysis-table">{children}</table>
    </section>
  )
}

export function SortHeader({
  label,
  href,
  direction,
}: {
  label: string
  href?: string
  direction?: 'ascending' | 'descending'
}) {
  return (
    <th scope="col" aria-sort={direction}>
      {href ? (
        <Link href={href}>
          {label}
          {direction && (direction === 'ascending' ? ' ↑' : ' ↓')}
        </Link>
      ) : (
        label
      )}
    </th>
  )
}

export function AnalysisPagination({
  page,
  pages,
  count,
  href,
}: {
  page: number
  pages: number
  count: number
  href: (page: number) => string
}) {
  return (
    <nav className="analysis-pagination" aria-label="Paginación">
      {page > 1 && (
        <Link className="underline" href={href(page - 1)}>
          Anterior
        </Link>
      )}
      <span>
        Página {page} de {pages} · {count} resultados
      </span>
      {page < pages && (
        <Link className="underline" href={href(page + 1)}>
          Siguiente
        </Link>
      )}
    </nav>
  )
}
