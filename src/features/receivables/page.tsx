import Link from 'next/link'
import { EmptyImport } from '@/components/empty-import'
import {
  AnalysisHeading,
  AnalysisPagination,
  AnalysisTable,
  QueryAlert,
  SortHeader,
} from '@/features/analysis/components'
import type { AnalysisPageProps } from '@/features/analysis/page'
import { tableHref } from '@/features/analysis/shared'
import { formatDay, formatMoney, formatPercent } from '@/lib/format'
import { requireRole } from '@/lib/server/auth'
import { getReceivables } from './queries'
import {
  receivablesOrders,
  receivablesSearchSchema,
  riskLabels,
  riskLevels,
  type ReceivablesSearch,
} from './schemas'

const aging = [
  ['Por vencer', 'current_balance'],
  ['1–30', 'd1_30'],
  ['31–60', 'd31_60'],
  ['61–90', 'd61_90'],
  ['Más de 90', 'd90_plus'],
] as const

export async function ReceivablesPage({
  params,
  searchParams,
}: AnalysisPageProps) {
  const { slug } = await params
  const path = `/o/${slug}/receivables`
  const raw = await searchParams
  const parsed = receivablesSearchSchema.safeParse({
    ...raw,
    q: raw.q === '' ? undefined : raw.q,
  })
  if (!parsed.success) {
    await requireRole(slug, 'owner', 'admin', 'analyst', 'viewer')
    return (
      <>
        <AnalysisHeading title="Cobranza" />
        <QueryAlert href={path} label="Restablecer consulta">
          Parámetros de consulta inválidos.
        </QueryAlert>
      </>
    )
  }

  const search = parsed.data
  const href = tableHref(path, search)
  const data = await getReceivables(slug, search)
  if ('error' in data) {
    return (
      <>
        <AnalysisHeading title="Cobranza" />
        <QueryAlert href={href()} label="Reintentar">
          No pudimos consultar las cuentas por cobrar.
        </QueryAlert>
      </>
    )
  }

  const heading = (
    <AnalysisHeading title="Cobranza">
      Saldos al {formatDay(data.today)}
    </AnalysisHeading>
  )
  if (data.state !== 'open') {
    return (
      <>
        {heading}
        {data.state === 'paid' ? (
          <p>No hay saldos pendientes</p>
        ) : (
          <EmptyImport
            slug={slug}
            role={data.role}
            label="Importar cuentas por cobrar"
            subject="las cuentas por cobrar"
          >
            Importa cuentas por cobrar en CSV o Excel para ver los saldos por
            cliente.
          </EmptyImport>
        )}
      </>
    )
  }

  const { summary, counts, rows } = data
  const header = (label: string, order: ReceivablesSearch['orden']) => (
    <SortHeader
      label={label}
      href={href({ orden: order })}
      direction={
        search.orden === order
          ? receivablesOrders[order][1]
            ? 'ascending'
            : 'descending'
          : undefined
      }
    />
  )

  return (
    <>
      {heading}
      <div className="dashboard-metrics receivables-metrics">
        <section className="dashboard-metric">
          <h2 className="label-condensed">Saldo por cobrar</h2>
          <p className="figure dashboard-figure">
            {formatMoney(summary.open_balance)}
          </p>
        </section>
        <section className="dashboard-metric">
          <h2 className="label-condensed">Saldo vencido</h2>
          <p className="figure dashboard-figure">
            {formatMoney(summary.overdue_balance)}
          </p>
          {summary.overdue_pct !== null && (
            <p className="metric-comparison">
              {formatPercent(summary.overdue_pct)} del saldo por cobrar
            </p>
          )}
          {summary.top5_share_pct !== null && (
            <p className="metric-comparison">
              Los 5 clientes con más saldo deben el{' '}
              {formatPercent(summary.top5_share_pct)}
            </p>
          )}
        </section>
      </div>

      <section
        className="analysis-scroll receivables-aging"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- La región desplazable requiere foco para recorrerla con teclado en móvil.
        tabIndex={0}
        aria-label="Antigüedad de saldos"
      >
        <table className="metrics-table">
          <caption className="label-condensed">
            Antigüedad de saldos (días)
          </caption>
          <thead>
            <tr>
              {aging.map(([label, key]) => (
                <th key={key} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {aging.map(([, key]) => (
                <td
                  key={key}
                  className={
                    key === 'd90_plus' && summary[key] > 0
                      ? 'risk-cell'
                      : undefined
                  }
                >
                  {formatMoney(summary[key])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </section>

      <div className="analysis-controls">
        <nav aria-label="Filtrar por riesgo" className="analysis-switch">
          {(['todos', ...riskLevels] as const).map((risk) => (
            <Link
              key={risk}
              href={href({ riesgo: risk })}
              aria-current={search.riesgo === risk ? 'page' : undefined}
            >
              {risk === 'todos' ? 'Todos' : riskLabels[risk]} ({counts[risk]})
            </Link>
          ))}
        </nav>
        <form method="get" action={path} className="analysis-search">
          <input type="hidden" name="riesgo" value={search.riesgo} />
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
              {Object.entries(receivablesOrders).map(([key, [, , label]]) => (
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
        <AnalysisTable label="Tabla de cuentas por cobrar por cliente">
          <thead>
            <tr>
              {header('Cliente', 'nombre')}
              {header('Saldo', 'saldo')}
              {header('Vencido', 'vencido')}
              <SortHeader label="Más de 90 días" />
              {header('Máximo de días vencidos', 'dias')}
              {header('Uso de crédito', 'credito')}
              <SortHeader label="Participación" />
              <SortHeader label="Riesgo" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.customer_id}>
                <th scope="row">
                  {row.name}
                  <span className="label-condensed analysis-code">
                    {row.code}
                  </span>
                </th>
                <td>{formatMoney(row.open_balance)}</td>
                <td>{formatMoney(row.overdue_balance)}</td>
                <td>{formatMoney(row.d90_plus)}</td>
                <td>{row.max_days_overdue || 'Al corriente'}</td>
                <td
                  className={
                    row.credit_used_pct !== null && row.credit_used_pct > 100
                      ? 'risk-cell'
                      : undefined
                  }
                >
                  {row.credit_used_pct === null
                    ? 'Sin límite'
                    : formatPercent(row.credit_used_pct)}
                </td>
                <td>{formatPercent(row.share_pct)}</td>
                <td>
                  <span
                    className={
                      row.risk === 'bajo'
                        ? 'text-muted-foreground'
                        : row.risk === 'alto'
                          ? 'risk-label risk-cell'
                          : 'risk-label'
                    }
                  >
                    {riskLabels[row.risk]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </AnalysisTable>
      ) : search.q ? (
        <p>
          Ningún cliente coincide con «{search.q}» para este filtro.{' '}
          <Link className="underline" href={href({ q: '' })}>
            Quitar búsqueda
          </Link>
        </p>
      ) : (
        <p>No hay clientes en este nivel de riesgo</p>
      )}
      <AnalysisPagination
        {...data}
        href={(pagina) => href({ pagina: String(pagina) })}
      />
    </>
  )
}
