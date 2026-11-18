import { expect, it } from 'vitest'
import { staleSnapshotDays } from './snapshot-age'

it.each([
  ['2026-11-17', null],
  ['2026-11-10', null],
  ['2026-11-09', 8],
] as const)(
  'avisa solo cuando el corte %s tiene más de siete días',
  (snapshot, expected) => {
    expect(staleSnapshotDays(snapshot, '2026-11-17')).toBe(expected)
  },
)
