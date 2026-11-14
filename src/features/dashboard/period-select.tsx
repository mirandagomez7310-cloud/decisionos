'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
export function PeriodSelect({ value }: { value: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  return (
    <label className="period-control">
      Periodo
      <select
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(search.toString())
          params.set('periodo', event.target.value)
          router.push(`${pathname}?${params}`, { scroll: false })
        }}
      >
        <option value="mtd">Mes en curso vs. anterior</option>
        <option value="last30">Últimos 30 días</option>
        <option value="prev_month">Mes anterior completo</option>
      </select>
    </label>
  )
}
