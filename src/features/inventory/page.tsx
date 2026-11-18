import Link from 'next/link'
import {
  AnalysisHeading,
  AnalysisPagination,
  AnalysisSummary,
  AnalysisTable,
  QueryAlert,
  SortHeader,
} from '@/features/analysis/components'
import type { AnalysisPageProps } from '@/features/analysis/page'
import { tableHref } from '@/features/analysis/shared'
import { EmptyImport } from '@/components/empty-import'
import { formatDay, formatMoney, formatPercent } from '@/lib/format'
import { requireRole } from '@/lib/server/auth'
import { staleSnapshotDays } from '@/lib/server/metrics/snapshot-age'
import { getInventory } from './queries'
import {
  inventoryOrders,
  inventorySearchSchema,
  type InventorySearch,
} from './schemas'

const number = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 3 })
const turnover = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export async function InventoryPage({
  params,
  searchParams,
}: AnalysisPageProps) {
  const { slug } = await params
  const path = `/o/${slug}/inventory`
  const raw = await searchParams
  const parsed = inventorySearchSchema.safeParse({
    ...raw,
    q: raw.q === '' ? undefined : raw.q,
  })
  if (!parsed.success) {
    await requireRole(slug, 'owner', 'admin', 'analyst', 'viewer')
    return (
      <>
        <AnalysisHeading title="Inventario" />
        <QueryAlert href={path} label="Restablecer consulta">
          Parámetros de consulta inválidos.
        </QueryAlert>
      </>
    )
  }
  const search = parsed.data
  const href = tableHref(path, search)
  const data = await getInventory(slug, search)
  if (data.error) {
    return (
      <>
        <AnalysisHeading title="Inventario" />
        <QueryAlert href={href()} label="Reintentar">
          No pudimos consultar el inventario.
        </QueryAlert>
      </>
    )
  }

  const { summary, today, role, rows } = data
  if (!summary.snapshot_on) {
    return (
      <>
        <AnalysisHeading title="Inventario" />
        <EmptyImport
          slug={slug}
          role={role}
          label="Importar inventario"
          subject="el inventario"
        >
          Importa existencias en CSV o Excel con SKU, fecha de corte y cantidad.
          El costo unitario es opcional.
        </EmptyImport>
      </>
    )
  }

  const age = staleSnapshotDays(summary.snapshot_on, today)
  const heading = (
    <AnalysisHeading title="Inventario">
      Existencias al {formatDay(summary.snapshot_on)}
      {age !== null && (
        <span className="risk-cell"> · corte de hace {age} días</span>
      )}
    </AnalysisHeading>
  )
  if (!summary.product_count) {
    return (
      <>
        {heading}
        <p>El último corte no tiene existencias</p>
      </>
    )
  }

  const header = (label: string, order: InventorySearch['orden']) => (
    <SortHeader
      label={label}
      href={href({ orden: order })}
      direction={
        search.orden === order
          ? inventoryOrders[order][1]
            ? 'ascending'
            : 'descending'
          : undefined
      }
    />
  )
  return (
    <>
      {heading}
      <div className="dashboard-metrics inventory-metrics">
        <section className="dashboard-metric">
          <h2 className="label-condensed">Valor sin movimiento</h2>
          <p className="figure dashboard-figure">
            {formatMoney(summary.stale_value)}
          </p>
          <p className="metric-comparison">
            {number.format(summary.stale_count)} productos
            {summary.stale_share_pct !== null &&
              ` · ${formatPercent(summary.stale_share_pct)} del valor total`}
          </p>
        </section>
        <section className="dashboard-metric">
          <h2 className="label-condensed">Días de inventario</h2>
          {summary.days_on_hand === null ? (
            <p className="missing-cost">Sin ventas con costo en 90 días</p>
          ) : (
            <p className="figure dashboard-figure">
              {number.format(summary.days_on_hand)}
            </p>
          )}
        </section>
        <section className="dashboard-metric">
          <h2 className="label-condensed">Valor de inventario</h2>
          <p className="figure dashboard-figure">
            {formatMoney(summary.inventory_value)}
          </p>
        </section>
        <section className="dashboard-metric">
          <h2 className="label-condensed">Rotación anual</h2>
          {summary.turnover === null ? (
            <p className="missing-cost">Sin rotación calculada</p>
          ) : (
            <p className="figure dashboard-figure">
              {turnover.format(summary.turnover)}
              <span className="margin-rate">veces al año</span>
            </p>
          )}
        </section>
      </div>
      {summary.value_coverage !== null && summary.value_coverage < 100 && (
        <AnalysisSummary>
          Valor calculado sobre el {number.format(summary.value_coverage)} % de
          los productos; el resto no tiene costo.{' '}
          <Link className="underline" href={`/o/${slug}/imports/new`}>
            Cómo importar costos
          </Link>
        </AnalysisSummary>
      )}

      <div className="analysis-controls">
        <nav aria-label="Filtrar inventario" className="analysis-switch">
          <Link
            href={href({ filtro: 'todos' })}
            aria-current={search.filtro === 'todos' ? 'page' : undefined}
          >
            Todos
          </Link>
          <Link
            href={href({ filtro: 'sin_movimiento' })}
            aria-current={
              search.filtro === 'sin_movimiento' ? 'page' : undefined
            }
          >
            Sin movimiento
          </Link>
        </nav>
        <form method="get" action={path} className="analysis-search">
          <input type="hidden" name="filtro" value={search.filtro} />
          <label>
            Buscar por nombre
            <input
              type="search"
              name="q"
              defaultValue={search.q}
              maxLength={80}
            />
          </label>
          <label>
            Orden
            <select name="orden" defaultValue={search.orden}>
              {Object.entries(inventoryOrders).map(([key, [, , label]]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="action-button" type="submit">
            Aplicar
          </button>
        </form>
      </div>

      {rows.length ? (
        <AnalysisTable label="Tabla de inventario por producto">
          <thead>
            <tr>
              {header('Producto', 'nombre')}
              <SortHeader label="Existencia" />
              <SortHeader label="Costo unitario" />
              {header('Valor', 'valor')}
              {header('Días de inventario', 'dias')}
              {header('Última venta', 'sin_venta')}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.product_id}>
                <th scope="row">
                  {row.name}
                  <span className="label-condensed analysis-code">
                    {row.sku}
                  </span>
                  {row.is_stale && (
                    <span className="risk-label risk-cell">Sin movimiento</span>
                  )}
                </th>
                <td>{number.format(row.quantity)}</td>
                <td>
                  {row.unit_cost === null ? (
                    <span className="label-condensed">Sin costo</span>
                  ) : (
                    formatMoney(row.unit_cost)
                  )}
                </td>
                <td>
                  {row.inventory_value !== null &&
                    formatMoney(row.inventory_value)}
                </td>
                <td>
                  {row.days_on_hand !== null && number.format(row.days_on_hand)}
                </td>
                <td>
                  {row.last_sold_on === null
                    ? 'Nunca'
                    : formatDay(row.last_sold_on)}
                  {row.days_since_sale !== null && (
                    <span className="label-condensed analysis-code">
                      {number.format(row.days_since_sale)} días sin venta
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </AnalysisTable>
      ) : search.q ? (
        <p>
          Ningún producto coincide con «{search.q}».{' '}
          <Link className="underline" href={href({ q: '' })}>
            Quitar búsqueda
          </Link>
        </p>
      ) : (
        <p>No hay productos sin movimiento</p>
      )}
      <AnalysisPagination
        {...data}
        href={(pagina) => href({ pagina: String(pagina) })}
      />
    </>
  )
}
