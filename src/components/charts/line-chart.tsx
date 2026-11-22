/* oxlint-disable jsx-a11y/prefer-tag-over-role -- El SVG mantiene ejes vectoriales y semántica de imagen. */
import { formatMoney, formatAxisMoney, formatDay } from '@/lib/format'
import { LineChartHover, type ChartRow } from './line-chart-hover'
type DailySale = { day: string; net_sales: number }
export function LineChart({
  current,
  previous,
  currentLabel,
  previousLabel,
}: {
  current: DailySale[]
  previous: DailySale[]
  currentLabel: string
  previousLabel: string
}) {
  const count = Math.max(current.length, previous.length)
  const rows: ChartRow[] = Array.from({ length: count }, (_, index) => ({
    currentDay: current[index]?.day,
    previousDay: previous[index]?.day,
    current: current[index]?.net_sales,
    previous: previous[index]?.net_sales,
  }))
  const values = [...current, ...previous].map((point) => point.net_sales)
  const min = Math.min(0, ...values)
  const max = Math.max(1, ...values)
  const y = (value: number) => 200 - ((value - min) / (max - min)) * 175
  // El SVG ocupa el área de trazado; ejes y etiquetas directas van en el padding de .chart-canvas (overflow visible).
  const x = (index: number) => `${(index / Math.max(1, count - 1)) * 100}%`
  // Coordenada numérica para el SVG interno (viewBox 100×200, sin proporción fija).
  const xn = (index: number) => (index / Math.max(1, count - 1)) * 100
  const path = (series: DailySale[]) =>
    series.map((point, index) => `${xn(index)},${y(point.net_sales)}`).join(' ')
  const last = current.at(-1)
  const prevLast = previous.at(-1)
  return (
    <section className="daily-chart card dashboard-section">
      <div className="section-head">
        <h2>Ventas diarias</h2>
        <div className="chart-legend">
          <span>Actual · {currentLabel}</span>
          <span>Anterior · {previousLabel}</span>
        </div>
      </div>
      <div className="chart-canvas">
        <svg
          role="img"
          aria-label={`Ventas diarias: actual ${currentLabel}, anterior ${previousLabel}. Último día actual: ${last ? formatMoney(last.net_sales) : 'sin datos'}. Tabla equivalente debajo.`}
          width="100%"
          height="240"
        >
          {[0, 1, 2, 3].map((tick) => {
            const value = min + ((max - min) * tick) / 3
            return (
              <g key={tick}>
                <line
                  x1="0%"
                  x2="100%"
                  y1={y(value)}
                  y2={y(value)}
                  className="chart-grid"
                />
                <text x="-64" y={y(value) + 4} className="chart-axis">
                  {formatAxisMoney(value)}
                </text>
              </g>
            )
          })}
          {rows.map((_, index) =>
            index % Math.max(1, Math.ceil(count / 5)) === 0 ||
            index === count - 1 ? (
              <text
                key={index}
                x={x(index)}
                y="230"
                textAnchor="middle"
                className="chart-axis"
              >
                {index + 1}
              </text>
            ) : null,
          )}
          <svg
            className="reveal-x"
            width="100%"
            height="200"
            viewBox="0 0 100 200"
            preserveAspectRatio="none"
            overflow="visible"
          >
            <defs>
              <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
                <stop
                  offset="0"
                  stopColor="var(--series-current)"
                  stopOpacity="0.24"
                />
                <stop
                  offset="1"
                  stopColor="var(--series-current)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            {current.length > 1 && (
              <polygon
                className="chart-area"
                points={`0,${y(0)} ${path(current)} ${xn(current.length - 1)},${y(0)}`}
              />
            )}
            {previous.length > 1 && (
              <polyline
                className="chart-previous"
                vectorEffect="non-scaling-stroke"
                points={path(previous)}
              />
            )}
            {current.length > 1 && (
              <polyline
                className="chart-current"
                vectorEffect="non-scaling-stroke"
                points={path(current)}
              />
            )}
          </svg>
          {previous.length === 1 && (
            <circle
              cx={x(0)}
              cy={y(previous[0]!.net_sales)}
              r="3"
              className="chart-previous"
            />
          )}
          {last && (
            <>
              <circle
                cx={x(current.length - 1)}
                cy={y(last.net_sales)}
                r="4"
                className="chart-marker"
              />
              <text
                x={x(current.length - 1)}
                y={Math.max(12, y(last.net_sales) - 10)}
                className="chart-direct"
                textAnchor="middle"
              >
                Actual
              </text>
            </>
          )}
          {prevLast && (
            <text
              x={x(previous.length - 1)}
              y={Math.min(216, y(prevLast.net_sales) + 16)}
              className="chart-direct"
              textAnchor="middle"
            >
              Anterior
            </text>
          )}
        </svg>
        <LineChartHover rows={rows} />
      </div>
      <details>
        <summary>Ver tabla</summary>
        <div className="overflow-x-auto">
          <table>
            <caption className="sr-only">Ventas diarias por periodo</caption>
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col">Actual · {currentLabel}</th>
                <th scope="col">Anterior · {previousLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <th scope="row">{index + 1}</th>
                  <td>
                    {row.currentDay ? formatDay(row.currentDay) : 'Sin día'}
                    <br />
                    {row.current === undefined
                      ? 'Sin dato'
                      : formatMoney(row.current)}
                  </td>
                  <td>
                    {row.previousDay ? formatDay(row.previousDay) : 'Sin día'}
                    <br />
                    {row.previous === undefined
                      ? 'Sin dato'
                      : formatMoney(row.previous)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}
