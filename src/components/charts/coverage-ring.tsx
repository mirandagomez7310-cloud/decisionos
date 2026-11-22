/** Anillo tipo Actividad: porcentaje del importe con costo. El texto de cobertura va al lado. */
export function CoverageRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <span className="ring-wrap" aria-hidden="true">
      <svg className="coverage-ring" viewBox="0 0 64 64">
        <circle className="ring-track" cx="32" cy="32" r="26" />
        <circle
          className="ring-value"
          cx="32"
          cy="32"
          r="26"
          pathLength={100}
          strokeDasharray={`${pct} 100`}
        />
      </svg>
      <span>{Math.round(pct)}%</span>
    </span>
  )
}
