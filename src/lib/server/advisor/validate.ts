import type { AdviceOutput } from '../ai/schema'
import type { AdvisorFact } from './facts'
import { marker, readMetric } from './render'

// Cifras escritas con letras también son cifras inventadas. Fuera «un/uno/una»: son artículos.
const numberWords =
  /(?<![\p{L}])(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieci\p{L}*|veint\p{L}*|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|cientos|\p{L}*cientos|\p{L}*cientas|mil|miles|mill[oó]n|millones|doble|triple|mitad|por ciento)(?![\p{L}])/iu

export const hasFreeNumber = (text: string) =>
  /\p{Nd}/u.test(text) || numberWords.test(text)

export function validateAdvice(output: AdviceOutput, facts: AdvisorFact[]) {
  const byId = new Map(facts.map((fact) => [fact.id, fact]))
  const items = output.items.filter((item) => {
    if (!item.cites.every((id) => byId.has(id))) return false

    return [item.title, item.body].every((text) => {
      if (hasFreeNumber(text.replace(marker, ''))) return false

      const digits = new Set<string>()
      const rendered = text.replace(marker, (_, id: string, field: string) => {
        const metric =
          item.cites.includes(id) && readMetric(byId.get(id), field)
        if (!metric) return '\u0000'
        for (const digit of metric.formatted.match(/\d+/g) ?? [])
          digits.add(digit)
        return metric.formatted
      })
      // Dos marcadores contiguos pueden fusionar sus dígitos en otra cifra.
      return (
        !rendered.includes('\u0000') &&
        (rendered.match(/\d+/g) ?? []).every((digit) => digits.has(digit))
      )
    })
  })
  return { items, rejected: output.items.length - items.length }
}
