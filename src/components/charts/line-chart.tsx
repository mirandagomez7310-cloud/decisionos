/* oxlint-disable jsx-a11y/prefer-tag-over-role -- El SVG mantiene ejes vectoriales y semántica de imagen. */
import { ChevronRight } from 'lucide-react'
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
  // Dominio en límites redondos alrededor de los datos (línea, no área: el cero no es obligatorio).
  const low = Math.min(...values, values.length ? Infinity : 0)
  const high = Math.max(...values, values.length ? -Infinity : 1)
  const domain = (raw: number) => {
    const magnitude = 10 ** Math.floor(Math.log10(raw))
    const tickStep =
      magnitude * ([1, 2, 2.5, 5, 10].find((f) => f * magnitude >= raw) ?? 10)
    const min = Math.floor(low / tickStep) * tickStep
    const max = Math.max(min + tickStep, Math.ceil(high / tickStep) * tickStep)
    const ticks = Array.from(
      { length: Math.round((max - min) / tickStep) + 1 },
      (_, index) => min + index * tickStep,
    )
    return { min, max, ticks, tickStep }
  }
  // El eje usa formato compacto de un decimal: si dos marcas se rotulan igual, el paso crece.
  let { min, max, ticks, tickStep } = domain(Math.max(1, high - low) / 3)
  while (new Set(ticks.map(formatAxisMoney)).size < ticks.length)
    ({ min, max, ticks, tickStep } = domain(tickStep * 2))
  const y = (value: number) => 200 - ((value - min) / (max - min)) * 175
  // El SVG ocupa el área de trazado; ejes y etiquetas directas van en el padding de .chart-canvas (overflow visible).
  const x = (index: number) => `${(index / Math.max(1, count - 1)) * 100}%`
  // Coordenada numérica para el SVG interno (viewBox 100×200, sin proporción fija).
  const step = Math.max(1, Math.ceil(count / 5))
  const xn = (index: number) => (index / Math.max(1, count - 1)) * 100
  const path = (series: DailySale[]) =>
    series.map((point, index) => `${xn(index)},${y(point.net_sales)}`).join(' ')
  const last = current.at(-1)
  const prevLast = previous.at(-1)
  // Etiquetas directas a la derecha del último punto; si coinciden en x y casi en y, se separan 16 px.
  const labels = { current: last ? y(last.net_sales) : 0, previous: prevLast ? y(prevLast.net_sales) : 0 }
  if (last && prevLast && current.length === previous.length && Math.abs(labels.current - labels.previous) < 16) {
    const middle = (labels.current + labels.previous) / 2
    const up = labels.current <= labels.previous
    labels.current = middle + (up ? -8 : 8)
    labels.previous = middle + (up ? 8 : -8)
  }
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
          {ticks.map((value) => {
            return (
              <g key={value}>
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
            // Marca cada `step` días y el último; omite la marca regular pegada al último.
            (index % step === 0 && count - 1 - index >= step / 2) ||
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
                dx="10"
                y={labels.current + 4}
                className="chart-direct"
              >
                Actual
              </text>
            </>
          )}
          {prevLast && (
            <text
              x={x(previous.length - 1)}
              dx="10"
              y={labels.previous + 4}
              className="chart-direct chart-direct-muted"
            >
              Anterior
            </text>
          )}
        </svg>
        <LineChartHover rows={rows} />
      </div>
      <details>
        <summary>
          <ChevronRight aria-hidden="true" />
          Ver tabla
        </summary>
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
