export function AnalysisLoading({ title }: { title: string }) {
  return (
    <div aria-busy="true" aria-label={`Cargando ${title}`}>
      <div className="skeleton-heading" />
      <div className="skeleton-heading" />
      <div className="analysis-scroll" aria-hidden="true">
        <table className="metrics-table analysis-table">
          <tbody>
            {Array.from({ length: 8 }, (_, index) => (
              <tr key={index}>
                {Array.from(
                  { length: title === 'ventas' ? 6 : 5 },
                  (_, column) => (
                    <td key={column}>
                      <div className="analysis-skeleton-cell">&nbsp;</div>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
