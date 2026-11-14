import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  formatMoneyChange,
  formatPercent,
  formatPercentChange,
  formatPoints,
  formatPeriod,
  formatAxisMoney,
} from './format'
describe('formatos del dashboard', () => {
  it('conserva centavos y usa signos explícitos y menos tipográfico', () => {
    expect(formatMoney(999999999.99)).toBe('$999,999,999.99')
    expect(formatMoney(-1234.5)).toBe('−$1,234.50')
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoneyChange(25)).toBe('+$25.00')
    expect(formatMoneyChange(-25)).toBe('−$25.00')
    expect(formatPercent(31)).toBe('31.0\u2009%')
    expect(formatPercentChange(12.3)).toBe('+12.3\u2009%')
    expect(formatPoints(-1.8)).toBe('−1.8 pts')
    expect(formatPoints(0)).toBe('+0.0 pts')
    expect(formatAxisMoney(80000)).toBe('$80 mil')
  })
  it('muestra los extremos del periodo, incluso entre años', () => {
    expect(formatPeriod('2026-11-01', '2026-11-13')).toBe('1–13 nov 2026')
    expect(formatPeriod('2025-12-20', '2026-01-18')).toBe(
      '20 dic 2025–18 ene 2026',
    )
  })
})
