export function staleSnapshotDays(snapshot: string, today: string) {
  const days = (Date.parse(today) - Date.parse(snapshot)) / 86_400_000
  return days > 7 ? days : null
}
