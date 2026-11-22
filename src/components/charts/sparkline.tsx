type Point = { net_sales: number }

/** Puntos "x,y" en un lienzo de 100×32; ambas series comparten escala. */
function points(series: Point[], min: number, max: number, count: number) {
  return series.map((point, index) => {
    const x = (index / Math.max(1, count - 1)) * 100
    const y = 30 - ((point.net_sales - min) / (max - min || 1)) * 28
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
}

/** Historia del periodo frente al anterior. Decorativa: la cifra y la tabla diaria llevan el dato. */
export function Sparkline({
  current,
  previous,
}: {
  current: Point[]
  previous: Point[]
}) {
  if (current.length < 2 && previous.length < 2) return null
  const values = [...current, ...previous].map((point) => point.net_sales)
  const min = Math.min(0, ...values)
  const max = Math.max(1, ...values)
  const count = Math.max(current.length, previous.length)
  const line = points(current, min, max, count)
  const last = line.at(-1)?.split(',')[0]
  return (
    <svg
      className="sparkline reveal-x"
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--series-current)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--series-current)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {previous.length > 1 && (
        <polyline
          className="spark-previous"
          vectorEffect="non-scaling-stroke"
          points={points(previous, min, max, count).join(' ')}
        />
      )}
      {current.length > 1 && (
        <>
          <polygon
            className="spark-area"
            points={`0,32 ${line.join(' ')} ${last},32`}
          />
          <polyline
            className="spark-current"
            vectorEffect="non-scaling-stroke"
            points={line.join(' ')}
          />
        </>
      )}
    </svg>
  )
}
