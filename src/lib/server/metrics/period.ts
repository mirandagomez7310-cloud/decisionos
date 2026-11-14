import { z } from '@/lib/zod'

export const periodSchema = z
  .enum(['mtd', 'last30', 'prev_month'])
  .default('mtd')

export function todayInMexico(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)!.value
  return part('year') + '-' + part('month') + '-' + part('day')
}

export function resolvePeriod(
  kind: z.infer<typeof periodSchema>,
  today: string,
) {
  const end = new Date(today + 'T00:00:00Z')
  const year = end.getUTCFullYear()
  const month = end.getUTCMonth()
  const date = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))
  const shift = (days: number) => date(year, month, end.getUTCDate() + days)
  const iso = (value: Date) => value.toISOString().slice(0, 10)
  if (kind === 'last30')
    return {
      from: iso(shift(-29)),
      to: today,
      prevFrom: iso(shift(-59)),
      prevTo: iso(shift(-30)),
    }
  if (kind === 'prev_month')
    return {
      from: iso(date(year, month - 1, 1)),
      to: iso(date(year, month, 0)),
      prevFrom: iso(date(year, month - 2, 1)),
      prevTo: iso(date(year, month - 1, 0)),
    }
  return {
    from: iso(date(year, month, 1)),
    to: today,
    prevFrom: iso(date(year, month - 1, 1)),
    prevTo: iso(
      date(
        year,
        month - 1,
        Math.min(end.getUTCDate(), date(year, month, 0).getUTCDate()),
      ),
    ),
  }
}
