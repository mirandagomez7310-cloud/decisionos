import { AnalysisHeading } from '@/features/analysis/components'

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando Diagnóstico">
      <AnalysisHeading title="Diagnóstico">
        Hallazgos calculados a partir de tus datos importados
      </AnalysisHeading>
      <div className="analysis-controls" aria-hidden="true">
        <div className="insight-filter-skeleton" />
        <div className="insight-filter-skeleton" />
      </div>
      <ol className="insight-list" aria-hidden="true">
        {[1, 2, 3].map((row) => (
          <li key={row}>
            <div className="skeleton-heading" />
          </li>
        ))}
      </ol>
    </div>
  )
}
