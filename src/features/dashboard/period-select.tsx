'use client'
import { useOptimistic, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
const options = [
  ['mtd', 'Mes en curso', 'Mes en curso vs. anterior'],
  ['last30', 'Últimos 30 días', 'Últimos 30 días'],
  ['prev_month', 'Mes anterior', 'Mes anterior completo'],
] as const
export function PeriodSelect({ value }: { value: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  // La opción marcada sigue al foco mientras llega la respuesta; la última navegación sustituye a las anteriores.
  const [selected, setSelected] = useOptimistic(value)
  const [, startTransition] = useTransition()
  return (
    <fieldset className="segmented">
      <legend className="sr-only">Periodo</legend>
      {options.map(([key, label, title]) => (
        <label key={key} title={title}>
          <input
            type="radio"
            name="periodo"
            value={key}
            checked={selected === key}
            onChange={() =>
              startTransition(() => {
                setSelected(key)
                const params = new URLSearchParams(search.toString())
                params.set('periodo', key)
                params.delete('pagina')
                router.push(`${pathname}?${params}`, { scroll: false })
              })
            }
          />
          {label}
        </label>
      ))}
    </fieldset>
  )
}
