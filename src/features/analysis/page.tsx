import Link from 'next/link'
import {
  AnalysisHeading,
  AnalysisPagination,
  AnalysisSummary,
  AnalysisTable,
  QueryAlert,
  SortHeader,
} from './components'
import { tableHref } from './shared'
import { requireRole } from '@/lib/server/auth'
import { PeriodSelect } from '@/features/dashboard/period-select'
import { EmptySales } from '@/features/dashboard/empty-sales'
import {
  formatMoney,
  formatMoneyChange,
  formatPercent,
  formatPercentChange,
  formatPeriod,
} from '@/lib/format'
import { getAnalysis } from './queries'
import {
  salesSearchSchema,
  marginSearchSchema,
  salesOrders,
  marginOrders,
  type AnalysisScreen,
  type AnalysisSearch,
} from './schemas'

export type AnalysisPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function AnalysisPage({
  params,
  searchParams,
  screen,
}: AnalysisPageProps & { screen: AnalysisScreen }) {
  const { slug } = await params
  const sales = screen === 'sales'
  const title = sales ? 'Ventas' : 'Margen'
  const path = `/o/${slug}/${screen}`
  const raw = await searchParams
  const parsed = (sales ? salesSearchSchema : marginSearchSchema).safeParse({
    ...raw,
    q: raw.q === '' ? undefined : raw.q,
  })
  if (!parsed.success) {
    await requireRole(slug, 'owner', 'admin', 'analyst', 'viewer')
    return (
      <>
        <h1>{title}</h1>
        <QueryAlert href={path} label="Restablecer consulta">
          Parámetros de consulta inválidos.
        </QueryAlert>
      </>
    )
  }
  const search = parsed.data
  const href = tableHref(path, search)
  const data = await getAnalysis(slug, screen, search)
  const heading = (
    <AnalysisHeading
      title={title}
      action={<PeriodSelect value={search.periodo} />}
    >
      {formatPeriod(data.period.from, data.period.to)} vs.{' '}
      {formatPeriod(data.period.prevFrom, data.period.prevTo)}
    </AnalysisHeading>
  )
  if (data.error)
    return (
      <>
        {heading}
        <QueryAlert href={href()} label="Reintentar">
          No pudimos consultar {sales ? 'las ventas' : 'el margen'}.
        </QueryAlert>
      </>
    )
  if (!data.hasSales)
    return (
      <>
        {heading}
        <EmptySales slug={slug} role={data.role} />
      </>
    )
  const orders = sales ? salesOrders : marginOrders
  const field = { ...salesOrders, ...marginOrders }[search.orden][0]
  const ascending = { ...salesOrders, ...marginOrders }[search.orden][1]
  const header = (
    label: string,
    column: string,
    order?: AnalysisSearch['orden'],
    reverse?: AnalysisSearch['orden'],
  ) => (
    <SortHeader
      label={label}
      direction={
        field === column ? (ascending ? 'ascending' : 'descending') : undefined
      }
      href={
        order
          ? href({ orden: search.orden === order && reverse ? reverse : order })
          : undefined
      }
    />
  )
  return (
    <>
      {heading}
      <div className="analysis-controls">
        <nav aria-label="Analizar por" className="analysis-switch">
          {(['productos', 'clientes'] as const).map((vista) => (
            <Link
              key={vista}
              href={href({ vista })}
              aria-current={search.vista === vista ? 'page' : undefined}
            >
              {vista === 'productos' ? 'Productos' : 'Clientes'}
            </Link>
          ))}
        </nav>
        <form method="get" action={path} className="analysis-search">
          <input type="hidden" name="periodo" value={search.periodo} />
          <input type="hidden" name="vista" value={search.vista} />
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
              {Object.entries(orders).map(([key, value]) => (
                <option key={key} value={key}>
                  {value[2]}
                </option>
              ))}
            </select>
          </label>
          <button className="action-button" type="submit">
            Aplicar
          </button>
        </form>
      </div>
      <AnalysisSummary>
        {sales ? (
          `Suben ${data.counts[0]} · Bajan ${data.counts[1]} · Sin cambio ${data.counts[2]}`
        ) : (
          <>
            Con pérdida {data.counts[0]} · Sin datos de costo {data.counts[1]}
            {data.counts[1]! > 0 && (
              <>
                {' '}
                ·{' '}
                <Link className="underline" href={`/o/${slug}/imports/new`}>
                  Cómo importar costos
                </Link>
              </>
            )}
          </>
        )}
      </AnalysisSummary>
      {!data.rows.length ? (
        <p>
          {search.q ? (
            <>
              Ningún {search.vista === 'productos' ? 'producto' : 'cliente'}{' '}
              coincide con «{search.q}».{' '}
              <Link className="underline" href={href({ q: '' })}>
                Quitar búsqueda
              </Link>
            </>
          ) : (
            'Sin ventas en el periodo'
          )}
        </p>
      ) : (
        <>
          {!data.hasCurrentSales && <p>Sin ventas en el periodo</p>}
          <AnalysisTable
            label={`Tabla de ${title.toLowerCase()} por ${search.vista}`}
          >
            <thead>
              <tr>
                {header(
                  search.vista === 'productos' ? 'Producto' : 'Cliente',
                  'name',
                  'nombre',
                )}
                {/* La cifra que responde la pantalla va junto al nombre: en móvil es lo que se ve sin desplazar. */}
                {sales ? (
                  <>
                    {header(
                      'Cambio en pesos',
                      'delta',
                      'cambio_baja',
                      'cambio_sube',
                    )}
                    {header('Cambio %', 'delta_pct')}
                    {header('Venta actual', 'net_sales', 'venta')}
                    {header('Venta anterior', 'prev_net_sales')}
                  </>
                ) : (
                  <>
                    {header(
                      'Margen %',
                      'margin_pct',
                      'margen_pct_asc',
                      'margen_pct_desc',
                    )}
                    {header('Margen en pesos', 'gross_margin', 'margen')}
                    {header('Venta', 'net_sales', 'venta')}
                    {header('Cobertura', 'coverage')}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const id = row.product_id ?? row.customer_id
                const code = row.sku ?? row.code
                const missing = row.coverage === null || row.coverage === 0
                const risk = !missing && row.gross_margin < 0
                return (
                  <tr key={id} id={`fila-${id}`}>
                    <th scope="row">
                      {row.name}
                      <span className="label-condensed analysis-code">
                        {code}
                      </span>
                    </th>
                    {sales ? (
                      <>
                        <td>{formatMoneyChange(row.delta)}</td>
                        <td>
                          {row.prev_net_sales === 0 || row.delta_pct === null
                            ? 'Sin comparación'
                            : formatPercentChange(row.delta_pct)}
                        </td>
                        <td>{formatMoney(row.net_sales)}</td>
                        <td>{formatMoney(row.prev_net_sales)}</td>
                      </>
                    ) : (
                      <>
                        <td className={risk ? 'risk-cell' : undefined}>
                          {!missing && row.margin_pct !== null ? (
                            <>
                              {formatPercent(row.margin_pct)}
                              {risk && (
                                <span className="risk-label">Riesgo</span>
                              )}
                            </>
                          ) : (
                            <span className="label-condensed">
                              Sin datos de costo
                            </span>
                          )}
                        </td>
                        <td className={risk ? 'risk-cell' : undefined}>
                          {!missing && formatMoney(row.gross_margin)}
                        </td>
                        <td>{formatMoney(row.net_sales)}</td>
                        <td className="label-condensed">
                          {missing
                            ? 'Sin datos de costo'
                            : `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(row.coverage!)} %`}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </AnalysisTable>
        </>
      )}
      <AnalysisPagination
        {...data}
        href={(pagina) => href({ pagina: String(pagina) })}
      />
      <footer className="dashboard-footer">
        Importes en MXN · Ventas completadas; canceladas y devueltas excluidas
      </footer>
    </>
  )
}
