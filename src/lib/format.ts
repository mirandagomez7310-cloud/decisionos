const money = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const decimal = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const minus = (text: string) => text.replace('-', '−')
export const formatMoney = (value: number) => minus(money.format(value))
export const formatMoneyChange = (value: number) =>
  (value >= 0 ? '+' : '') + formatMoney(value)
export const formatPercent = (value: number) =>
  minus(decimal.format(value)) + '\u2009%'
export const formatPercentChange = (value: number) =>
  (value >= 0 ? '+' : '') + formatPercent(value)
export const formatPoints = (value: number) =>
  (value >= 0 ? '+' : '') + minus(decimal.format(value)) + ' pts'
export function formatPeriod(from: string, to: string) {
  const start = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')
  const full = (date: Date) =>
    new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
      .format(date)
      .replaceAll(' de ', ' ')
      .replaceAll('.', '')
  return start.getUTCMonth() === end.getUTCMonth() &&
    start.getUTCFullYear() === end.getUTCFullYear()
    ? `${start.getUTCDate()}–${full(end)}`
    : `${full(start)}–${full(end)}`
}
export const formatAxisMoney = (value: number) =>
  minus(
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      notation: 'compact',
      maximumFractionDigits: 1,
    })
      .format(value)
      .replace(/\s*k$/, ' mil'),
  )
