import { describe, expect, it } from 'vitest'
import { periodSchema, resolvePeriod, todayInMexico } from './period'

describe('periods', () => {
  it('mtd 2026-01-01', () => {
    expect(resolvePeriod('mtd', '2026-01-01')).toEqual({
      from: '2026-01-01',
      to: '2026-01-01',
      prevFrom: '2025-12-01',
      prevTo: '2025-12-01',
    })
  })
  it('mtd 2026-03-31', () => {
    expect(resolvePeriod('mtd', '2026-03-31')).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
      prevFrom: '2026-02-01',
      prevTo: '2026-02-28',
    })
  })
  it('mtd 2024-03-31', () => {
    expect(resolvePeriod('mtd', '2024-03-31')).toEqual({
      from: '2024-03-01',
      to: '2024-03-31',
      prevFrom: '2024-02-01',
      prevTo: '2024-02-29',
    })
  })
  it('mtd 2024-02-29', () => {
    expect(resolvePeriod('mtd', '2024-02-29')).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
      prevFrom: '2024-01-01',
      prevTo: '2024-01-29',
    })
  })
  it('mtd 2026-04-30', () => {
    expect(resolvePeriod('mtd', '2026-04-30')).toEqual({
      from: '2026-04-01',
      to: '2026-04-30',
      prevFrom: '2026-03-01',
      prevTo: '2026-03-30',
    })
  })
  it('mtd 2026-12-31', () => {
    expect(resolvePeriod('mtd', '2026-12-31')).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
      prevFrom: '2026-11-01',
      prevTo: '2026-11-30',
    })
  })
  it('last30 2026-01-01', () => {
    expect(resolvePeriod('last30', '2026-01-01')).toEqual({
      from: '2025-12-03',
      to: '2026-01-01',
      prevFrom: '2025-11-03',
      prevTo: '2025-12-02',
    })
  })
  it('last30 2024-03-31', () => {
    expect(resolvePeriod('last30', '2024-03-31')).toEqual({
      from: '2024-03-02',
      to: '2024-03-31',
      prevFrom: '2024-02-01',
      prevTo: '2024-03-01',
    })
  })
  it('previous full months across year', () => {
    expect(resolvePeriod('prev_month', '2026-01-01')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
      prevFrom: '2025-11-01',
      prevTo: '2025-11-30',
    })
  })
  it('previous leap month', () => {
    expect(resolvePeriod('prev_month', '2024-03-31')).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
      prevFrom: '2024-01-01',
      prevTo: '2024-01-31',
    })
  })
  it('Mexico midnight boundary', () => {
    expect(todayInMexico(new Date('2026-01-01T05:30:00Z'))).toBe('2025-12-31')
    expect(todayInMexico(new Date('2026-01-01T06:00:00Z'))).toBe('2026-01-01')
  })
  it('validates the query parameter', () => {
    expect(periodSchema.parse(undefined)).toBe('mtd')
    for (const value of ['mtd', 'last30', 'prev_month'])
      expect(periodSchema.parse(value)).toBe(value)
    expect(periodSchema.safeParse('').success).toBe(false)
    expect(periodSchema.safeParse('year').success).toBe(false)
  })
})
