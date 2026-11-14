export function LocationTag({
  code,
  name,
  period,
}: {
  code: string
  name: string
  period: string
}) {
  return (
    <div className="location-tag">
      <b className="label-condensed">{code}</b>
      <h2>{name}</h2>
      <span className="label-condensed">{period}</span>
    </div>
  )
}
