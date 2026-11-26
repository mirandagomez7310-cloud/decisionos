import { statusLabels } from '../queries'

// Pendiente pide una acción (aviso); fallido es riesgo; el resto es informativo.
const tones: Record<string, 'warning' | 'risk' | undefined> = {
  pending: 'warning',
  failed: 'risk',
}

export function StatusChip({ status }: { status: string }) {
  return (
    <span className="status-chip" data-tone={tones[status]}>
      {statusLabels[status] ?? status}
    </span>
  )
}
