import Link from 'next/link'
import type { ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'

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

/** Barra divergente decorativa: el centro es cero; la cifra exacta va al lado en texto. */
export function DeltaBar({ value, scale }: { value: number; scale: number }) {
  return (
    <span className="delta-bar" aria-hidden="true">
      {value !== 0 && (
        <span
          data-trend={value > 0 ? 'up' : 'down'}
          style={{ width: `${Math.min(1, Math.abs(value) / scale) * 50}%` }}
        />
      )}
    </span>
  )
}

type SummaryPart = [
  label: string,
  count: number,
  tone: 'up' | 'down' | 'flat' | 'missing',
]

/**
 * Resumen del listado. Con `parts`, cada recuento va en su chip; con `bar`, además
 * una barra de proporciones (las partes deben sumar el total). Sin `parts`, texto libre.
 */
export function AnalysisSummary({
  parts,
  bar = false,
  children,
}: {
  parts?: SummaryPart[]
  bar?: boolean
  children?: ReactNode
}) {
  if (!parts) return <p className="analysis-summary">{children}</p>
  const total = parts.reduce((sum, [, count]) => sum + count, 0)
  return (
    <div className="analysis-summary summary-chips">
      {bar && total > 0 && (
        <div className="summary-bar" aria-hidden="true">
          {parts.map(([label, count, tone]) =>
            count ? (
              <span key={label} data-tone={tone} style={{ flexGrow: count }} />
            ) : null,
          )}
        </div>
      )}
      <p>
        {parts.map(([label, count, tone]) => (
          <span key={label} className="summary-chip" data-tone={tone}>
            {label} <strong>{count}</strong>
          </span>
        ))}
        {children}
      </p>
    </div>
  )
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
    <section className="analysis-scroll card" tabIndex={0} aria-label={label}>
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
        <Link href={href} className="sort-link">
          {label}
          {direction === 'ascending' && <ChevronUp aria-hidden="true" />}
          {direction === 'descending' && <ChevronDown aria-hidden="true" />}
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
        <Link className="page-pill" href={href(page - 1)}>
          <ChevronLeft aria-hidden="true" />
          Anterior
        </Link>
      )}
      <span>
        Página {page} de {pages} · {count} resultados
      </span>
      {page < pages && (
        <Link className="page-pill" href={href(page + 1)}>
          Siguiente
          <ChevronRight aria-hidden="true" />
        </Link>
      )}
    </nav>
  )
}
