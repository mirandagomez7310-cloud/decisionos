import type { Json } from '@/lib/supabase/types'
import { z } from '@/lib/zod'

const evidenceSchema = z.object({
  priority: z.number().int().min(1).max(5).catch(5),
  cites: z.array(z.uuid()).catch([]),
})

export function sortRecommendations<
  T extends { evidence: Json; created_at: string },
>(rows: T[]) {
  return rows
    .map((row) => ({
      ...row,
      ...evidenceSchema.parse(
        row.evidence &&
          typeof row.evidence === 'object' &&
          !Array.isArray(row.evidence)
          ? row.evidence
          : {},
      ),
    }))
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        Date.parse(b.created_at) - Date.parse(a.created_at),
    )
}

export function priorityLabel(priority: number) {
  return `Prioridad ${priority <= 2 ? 'alta' : priority === 3 ? 'media' : 'baja'}`
}

export function remainingAdvice(used: number, limit: number) {
  return Math.max(0, limit - used)
}

const errors = new Map([
  ['refusal', 'No pudimos generar recomendaciones con estos hallazgos.'],
  [
    'max_tokens',
    'La respuesta quedó incompleta. Vuelve a pedir recomendaciones.',
  ],
  [
    'api_error',
    'El servicio de recomendaciones no respondió. Inténtalo de nuevo.',
  ],
  [
    'invalid_output',
    'La respuesta recibida no se pudo usar. Inténtalo de nuevo.',
  ],
  [
    'no_valid_items',
    'No encontramos recomendaciones respaldadas por tus hallazgos.',
  ],
  ['no_facts', 'Primero importa datos para tener hallazgos'],
  ['disabled', 'Las recomendaciones no están activas en este entorno'],
  ['limit', 'Has usado las consultas de hoy'],
])

export function adviceError(error: string | null) {
  return (
    (error && errors.get(error)) ||
    'No pudimos completar la solicitud de recomendaciones. Inténtalo de nuevo.'
  )
}
