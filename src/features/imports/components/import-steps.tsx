import { Check } from 'lucide-react'

const steps = ['Archivo', 'Columnas', 'Revisión']

/** Pasos del asistente de importación; el número sí informa: es un recorrido en orden. */
export function ImportSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="import-steps" aria-label={`Paso ${current} de 3`}>
      {steps.map((step, index) => (
        <li
          key={step}
          aria-current={index + 1 === current ? 'step' : undefined}
          data-done={index + 1 < current || undefined}
        >
          <span aria-hidden="true">
            {index + 1 < current ? <Check /> : index + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  )
}
