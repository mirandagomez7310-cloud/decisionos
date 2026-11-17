export default function Loading() {
  return (
    <div
      aria-label="Cargando resumen ejecutivo"
      aria-busy="true"
      className="dashboard-skeleton"
    >
      <div className="skeleton-heading" />
      <div className="dashboard-metrics">
        <div className="skeleton-metric" />
        <div className="skeleton-metric" />
      </div>
      <div className="skeleton-chart" />
      <div className="dashboard-tables">
        <div className="skeleton-metric" />
        <div className="skeleton-metric" />
      </div>
    </div>
  )
}
