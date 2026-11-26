import Link from 'next/link'
import { EmptyImport } from '@/components/empty-import'
import {
  AnalysisHeading,
  AnalysisPagination,
  AnalysisTable,
  MetricIcon,
  QueryAlert,
  SearchField,
  SortHeader,
} from '@/features/analysis/components'
import type { AnalysisPageProps } from '@/features/analysis/page'
import { tableHref } from '@/features/analysis/shared'
import { CalendarClock, Wallet } from 'lucide-react'
import {
  formatDay,
  formatMoney,
  formatMoneyWhole,
  formatPercent,
} from '@/lib/format'
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
            title="Aún no hay cuentas por cobrar"
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
      <div className="dashboard-metrics">
        <section className="dashboard-metric card">
          <div className="metric-head">
            <MetricIcon tone="--m-receivables">
              <Wallet />
            </MetricIcon>
            <h2>Saldo por cobrar</h2>
          </div>
          <p className="figure dashboard-figure">
            {formatMoneyWhole(summary.open_balance)}
          </p>
          <div className="aging">
            <div className="aging-bar" aria-hidden="true">
              {aging.map(([label, key], index) =>
                summary[key] > 0 ? (
                  <span
                    key={key}
                    data-step={index}
                    style={{ flexGrow: summary[key] }}
                    title={label}
                  />
                ) : null,
              )}
            </div>
            <dl aria-label="Antigüedad de saldos (días)">
              {aging.map(([label, key], index) => (
                <div key={key} data-step={index}>
                  <dt>{label}</dt>
                  <dd>{formatMoney(summary[key])}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
        <section className="dashboard-metric card">
          <div className="metric-head">
            <MetricIcon tone="--m-receivables">
              <CalendarClock />
            </MetricIcon>
            <h2>Saldo vencido</h2>
          </div>
          <p className="figure dashboard-figure">
            {formatMoneyWhole(summary.overdue_balance)}
            {summary.overdue_pct !== null && (
              <span className="margin-rate">
                {' '}
                · {formatPercent(summary.overdue_pct)}
              </span>
            )}
          </p>
          <p className="metric-comparison">
            {summary.d90_plus > 0 ? (
              <>
                <strong data-trend="down">
                  {formatMoney(summary.d90_plus)}
                </strong>{' '}
                con más de 90 días
              </>
            ) : (
              'Nada con más de 90 días'
            )}
          </p>
          {summary.top5_share_pct !== null && (
            <p className="metric-comparison">
              Los 5 clientes con más saldo deben el{' '}
              {formatPercent(summary.top5_share_pct)}
            </p>
          )}
        </section>
      </div>

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
          <SearchField defaultValue={search.q} />
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
          <button className="action-button compact" type="submit">
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
                  {row.credit_used_pct === null ? (
                    'Sin límite'
                  ) : (
                    <div className="delta-cell">
                      {formatPercent(row.credit_used_pct)}
                      <span className="usage-meter" aria-hidden="true">
                        <span
                          style={{
                            width: `${Math.min(100, row.credit_used_pct)}%`,
                          }}
                        />
                      </span>
                    </div>
                  )}
                </td>
                <td>{formatPercent(row.share_pct)}</td>
                <td>
                  <span className="risk-chip" data-risk={row.risk}>
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
