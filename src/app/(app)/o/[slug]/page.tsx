import Link from 'next/link'
import { DashboardInsights } from '@/features/insights/components'
import { QueryAlert } from '@/features/analysis/components'
import { getDashboard } from '@/features/dashboard/queries'
import { EmptySales } from '@/features/dashboard/empty-sales'
import { PeriodSelect } from '@/features/dashboard/period-select'
import { LocationTag } from '@/components/location-tag'
import { LineChart } from '@/components/charts/line-chart'
import {
  formatMoney,
  formatMoneyChange,
  formatPercent,
  formatPercentChange,
  formatPoints,
  formatPeriod,
} from '@/lib/format'
import type { MetricMovement } from '@/lib/supabase/types'

function Movements({
  title,
  rows,
  products = false,
  slug,
  period,
}: {
  title: string
  rows: MetricMovement[]
  products?: boolean
  slug: string
  period: string
}) {
  return (
    <section>
      <h3>{title}</h3>
      {rows.length ? (
        <table className="metrics-table">
          <thead>
            <tr>
              <th scope="col">{products ? 'Producto' : 'Cliente'}</th>
              <th scope="col">Cambio en venta</th>
              {products && <th scope="col">Margen %</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <th scope="row">
                  <Link
                    className="underline"
                    href={`/o/${slug}/${products ? 'margin' : 'sales'}?${new URLSearchParams({ vista: products ? 'productos' : 'clientes', periodo: period, q: row.name })}#fila-${'product_id' in row ? row.product_id : 'customer_id' in row ? row.customer_id : ''}`}
                  >
                    {row.name}
                  </Link>
                </th>
                <td>{formatMoneyChange(row.delta)}</td>
                {products && (
                  <td
                    className={
                      row.margin_pct !== null && row.margin_pct < 0
                        ? 'risk-cell'
                        : undefined
                    }
                  >
                    {row.margin_pct === null
                      ? 'Sin datos de costo'
                      : formatPercent(row.margin_pct)}
                    {row.margin_pct !== null && row.margin_pct < 0 && (
                      <span className="risk-label">Riesgo</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Sin cambios entre los dos periodos</p>
      )}
    </section>
  )
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ periodo?: string }>
}) {
  const { slug } = await params
  const data = await getDashboard(slug, (await searchParams).periodo)
  const currentLabel = formatPeriod(data.period.from, data.period.to)
  const previousLabel = formatPeriod(data.period.prevFrom, data.period.prevTo)
  const heading = (
    <div className="dashboard-head">
      <div>
        <h1>Resumen ejecutivo</h1>
        <p>
          {currentLabel} vs. {previousLabel}
        </p>
      </div>
      <PeriodSelect value={data.kind} />
    </div>
  )
  if (data.error)
    return (
      <>
        {heading}
        <p role="alert">
          No pudimos consultar el resumen.{' '}
          <Link className="underline" href={`/o/${slug}?periodo=${data.kind}`}>
            Reintentar
          </Link>
        </p>
      </>
    )
  const diagnosis = data.insightsError ? (
    <QueryAlert href={`/o/${slug}?periodo=${data.kind}`} label="Reintentar">
      No pudimos consultar el diagnóstico.
    </QueryAlert>
  ) : (
    <DashboardInsights slug={slug} rows={data.insights} />
  )
  if (!data.hasSales)
    return (
      <>
        {heading}
        {/* Con hallazgos de inventario o cobranza, van antes del aviso de ventas. */}
        {diagnosis}
        <EmptySales slug={slug} role={data.role} />
      </>
    )
  const s = data.summary
  const month = new Intl.DateTimeFormat('es-MX', {
    month: 'short',
    timeZone: 'UTC',
  })
    .format(new Date(data.period.to + 'T00:00:00Z'))
    .replace('.', '')
    .toUpperCase()
  const noSales = s.sales_count === 0
  const costAvailable = s.coverage !== null && s.coverage > 0
  return (
    <>
      {heading}
      <div
        className="dashboard-metrics"
        key={`${data.period.from}:${data.period.to}`}
      >
        <section className="dashboard-metric">
          <LocationTag
            code={`VTA · ${month}`}
            name="Ventas netas"
            period={currentLabel}
          />
          <p className="figure dashboard-figure">{formatMoney(s.net_sales)}</p>
          <p className="metric-comparison">
            <strong>
              {s.net_sales_change_pct === null
                ? 'Sin comparación'
                : formatPercentChange(s.net_sales_change_pct)}
            </strong>{' '}
            frente a {formatMoney(s.prev_net_sales)}
          </p>
          <p className="label-condensed metric-status">
            {noSales ? 'Sin ventas en el periodo' : 'Completa'}
          </p>
        </section>
        <section className="dashboard-metric">
          <LocationTag
            code={`MGN · ${month}`}
            name="Margen bruto"
            period={currentLabel}
          />
          {costAvailable || noSales ? (
            <p className="figure dashboard-figure">
              {formatMoney(s.gross_margin)}
              {costAvailable && s.margin_pct !== null && (
                <span className="margin-rate">
                  {' '}
                  · {formatPercent(s.margin_pct)}
                </span>
              )}
            </p>
          ) : (
            <div className="missing-cost">
              <p>Sin datos de costo</p>
              <Link className="underline" href={`/o/${slug}/imports/new`}>
                Cómo importar costos
              </Link>
            </div>
          )}
          <p className="metric-comparison">
            <strong>
              {s.margin_pct_change_pts === null
                ? 'Sin comparación'
                : formatPoints(s.margin_pct_change_pts)}
            </strong>
            {s.prev_margin_pct !== null && (
              <> frente a {formatPercent(s.prev_margin_pct)}</>
            )}
          </p>
          <p className="label-condensed metric-status">
            {noSales
              ? 'Sin ventas en el periodo'
              : !costAvailable
                ? 'Sin datos de costo'
                : s.coverage === 100
                  ? 'Completa'
                  : `Cobertura: ${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(s.coverage!)} % del importe con costo`}
          </p>
        </section>
      </div>
      {diagnosis}
      <LineChart
        current={data.current}
        previous={data.previous}
        currentLabel={currentLabel}
        previousLabel={previousLabel}
      />
      <section className="dashboard-explain">
        <h2>Qué explica el cambio</h2>
        <div className="dashboard-tables">
          <Movements
            title="Productos que más mueven la venta"
            rows={data.products}
            slug={slug}
            period={data.kind}
            products
          />
          <Movements
            title="Clientes"
            rows={data.customers}
            slug={slug}
            period={data.kind}
          />
        </div>
      </section>
      <footer className="dashboard-footer">
        Importes en MXN · Ventas completadas; canceladas y devueltas excluidas
      </footer>
    </>
  )
}
