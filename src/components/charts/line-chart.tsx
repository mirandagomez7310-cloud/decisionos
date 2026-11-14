/* oxlint-disable jsx-a11y/prefer-tag-over-role -- El SVG mantiene ejes vectoriales y semántica de imagen. */
import { formatMoney, formatAxisMoney } from '@/lib/format'
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
  const x = (index: number) => `${16 + (index / Math.max(1, count - 1)) * 66}%`
  const last = current.at(-1)
  const prevLast = previous.at(-1)
  return (
    <section className="daily-chart">
      <h2>Ventas diarias</h2>
      <div className="chart-legend">
        <span>Actual · {currentLabel}</span>
        <span>Anterior · {previousLabel}</span>
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
                  x1="16%"
                  x2="82%"
                  y1={y(value)}
                  y2={y(value)}
                  className="chart-grid"
                />
                <text x="0" y={y(value) + 4} className="chart-axis">
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
          {[previous, current].map((series, seriesIndex) => (
            <g
              key={seriesIndex}
              className={seriesIndex ? 'chart-current' : 'chart-previous'}
            >
              {series.map((point, index) =>
                index > 0 ? (
                  <line
                    key={point.day}
                    x1={x(index - 1)}
                    x2={x(index)}
                    y1={y(series[index - 1]!.net_sales)}
                    y2={y(point.net_sales)}
                  />
                ) : (
                  <circle
                    key={point.day}
                    cx={x(index)}
                    cy={y(point.net_sales)}
                    r="2"
                  />
                ),
              )}
            </g>
          ))}
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
                    {row.currentDay ?? 'Sin día'}
                    <br />
                    {row.current === undefined
                      ? 'Sin dato'
                      : formatMoney(row.current)}
                  </td>
                  <td>
                    {row.previousDay ?? 'Sin día'}
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
