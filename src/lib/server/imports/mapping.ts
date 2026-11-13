import 'server-only'
import { fields, type Kind } from './kinds'

export type Mapping = Record<string, string | null>
export const normalizeHeader = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f\s_-]/g, '')
    .toLowerCase()

export function suggestMapping(headers: string[], kind: Kind): Mapping {
  const used = new Set<string>()
  return Object.fromEntries(
    fields[kind].map((field) => {
      const matches = headers.filter(
        (header) =>
          !used.has(header) &&
          field.synonyms.some(
            (alias) => normalizeHeader(alias) === normalizeHeader(header),
          ),
      )
      const header = matches.length === 1 ? matches[0]! : null
      if (header !== null) used.add(header)
      return [field.name, header]
    }),
  )
}

export function validateMapping(mapping: Mapping, kind: Kind): string[] {
  const errors: string[] = []
  const used = new Set<string>()
  for (const field of fields[kind]) {
    const header = mapping[field.name]
    if (!header?.trim()) {
      if (field.required)
        errors.push(`Falta asignar la columna de ${field.label}`)
    } else if (used.has(header))
      errors.push(`La cabecera «${header}» está usada dos veces`)
    else used.add(header)
  }
  return errors
}
