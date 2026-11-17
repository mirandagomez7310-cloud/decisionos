import Link from 'next/link'
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
        <p role="alert">
          Parámetros de consulta inválidos.{' '}
          <Link className="underline" href={path}>
            Restablecer consulta
          </Link>
        </p>
      </>
    )
  }
  const search = parsed.data
  const href = (
    changes: Partial<Record<keyof AnalysisSearch, string>> = {},
  ) => {
    // Sin filtrar, `q` ausente se serializaría como «undefined» y filtraría por ese texto.
    const values = new URLSearchParams(
      Object.entries({ ...search, pagina: '1', ...changes }).filter(
        (entry): entry is [string, string] => Boolean(entry[1]),
      ),
    )
    return `${path}?${values}`
  }
  const data = await getAnalysis(slug, screen, search)
  const heading = (
    <div className="dashboard-head">
      <div>
        <h1>{title}</h1>
        <p>
          {formatPeriod(data.period.from, data.period.to)} vs.{' '}
          {formatPeriod(data.period.prevFrom, data.period.prevTo)}
        </p>
      </div>
      <PeriodSelect value={search.periodo} />
    </div>
  )
  if (data.error)
    return (
      <>
        {heading}
        <p role="alert">
          No pudimos consultar {sales ? 'las ventas' : 'el margen'}.{' '}
          <Link className="underline" href={href()}>
            Reintentar
          </Link>
        </p>
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
    <th
      scope="col"
      aria-sort={
        field === column ? (ascending ? 'ascending' : 'descending') : undefined
      }
    >
      {order ? (
        <Link
          href={href({
            orden: search.orden === order && reverse ? reverse : order,
          })}
        >
          {label}
          {field === column ? (ascending ? ' ↑' : ' ↓') : ''}
        </Link>
      ) : (
        label
      )}
    </th>
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
      <p className="analysis-summary">
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
      </p>
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
          {/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- La región desplazable requiere foco para recorrer la tabla con teclado. */}
          <section
            className="analysis-scroll"
            tabIndex={0}
            aria-label={`Tabla de ${title.toLowerCase()} por ${search.vista}`}
          >
            <table className="metrics-table analysis-table">
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
            </table>
          </section>
        </>
      )}
      <nav className="analysis-pagination" aria-label="Paginación">
        {data.page > 1 && (
          <Link
            className="underline"
            href={href({ pagina: String(data.page - 1) })}
          >
            Anterior
          </Link>
        )}
        <span>
          Página {data.page} de {data.pages} · {data.count} resultados
        </span>
        {data.page < data.pages && (
          <Link
            className="underline"
            href={href({ pagina: String(data.page + 1) })}
          >
            Siguiente
          </Link>
        )}
      </nav>
      <footer className="dashboard-footer">
        Importes en MXN · Ventas completadas; canceladas y devueltas excluidas
      </footer>
    </>
  )
}
