import Link from 'next/link'
import { getDashboard } from '@/features/dashboard/queries'
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
}: {
  title: string
  rows: MetricMovement[]
  products?: boolean
}) {
  return (
    <section>
      <h3>{title}</h3>
      {rows.length ? (
        <table>
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
                <th scope="row">{row.name}</th>
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
  if (!data.hasSales)
    return (
      <>
        {heading}
        <section className="dashboard-empty">
          <h2>Aún no hay datos</h2>
          <p>
            Importa ventas en CSV o Excel con folio, fecha, cliente, producto,
            cantidad y precio. El costo es opcional y permite calcular el
            margen.
          </p>
          {data.role === 'owner' || data.role === 'admin' ? (
            <Link className="action-button" href={`/o/${slug}/imports/new`}>
              Importar ventas
            </Link>
          ) : (
            <p>Pide a un propietario o administrador que importe las ventas.</p>
          )}
        </section>
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
            products
          />
          <Movements title="Clientes" rows={data.customers} />
        </div>
      </section>
      <footer className="dashboard-footer">
        Importes en MXN · Ventas completadas; canceladas y devueltas excluidas
      </footer>
    </>
  )
}
