'use client'
import { useState } from 'react'
import { formatMoney } from '@/lib/format'
export type ChartRow = {
  currentDay?: string
  previousDay?: string
  current?: number
  previous?: number
}
export function LineChartHover({ rows }: { rows: ChartRow[] }) {
  const [active, setActive] = useState<number | null>(null)
  const row = active === null ? null : rows[active]
  return (
    <div className="chart-hover">
      <input
        className="chart-input"
        type="range"
        min={1}
        max={Math.max(1, rows.length)}
        value={(active ?? 0) + 1}
        onChange={(event) => setActive(Number(event.target.value) - 1)}
        aria-valuetext={
          row ? `${row.currentDay ?? row.previousDay}` : 'Sin día seleccionado'
        }
        aria-label="Explorar ventas diarias. Usa las flechas izquierda y derecha."
        onFocus={() => setActive(0)}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          setActive(
            Math.max(
              0,
              Math.min(
                rows.length - 1,
                Math.round(
                  (((event.clientX - box.left) / box.width - 0.16) / 0.66) *
                    Math.max(1, rows.length - 1),
                ),
              ),
            ),
          )
        }}
        onKeyDown={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            setActive((index) =>
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? rows.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        rows.length - 1,
                        (index ?? 0) + (event.key === 'ArrowRight' ? 1 : -1),
                      ),
                    ),
            )
          }
        }}
      />
      {row && (
        <>
          <svg aria-hidden="true" width="100%" height="240">
            <line
              x1={`${16 + ((active ?? 0) / Math.max(1, rows.length - 1)) * 66}%`}
              x2={`${16 + ((active ?? 0) / Math.max(1, rows.length - 1)) * 66}%`}
              y1="18"
              y2="200"
              className="chart-crosshair"
            />
          </svg>
          <output className="chart-tooltip">
            Actual · {row.currentDay ?? 'Sin día equivalente'}:{' '}
            {row.current === undefined ? 'Sin dato' : formatMoney(row.current)}
            <br />
            Anterior · {row.previousDay ?? 'Sin día equivalente'}:{' '}
            {row.previous === undefined
              ? 'Sin dato'
              : formatMoney(row.previous)}
          </output>
        </>
      )}
    </div>
  )
}
