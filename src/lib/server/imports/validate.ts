import 'server-only'
import { fields, schemas, type Field, type Kind } from './kinds'
import { validateMapping, type Mapping } from './mapping'

export interface RowOk {
  rowNumber: number
  data: Record<string, unknown>
}
export interface RowError {
  rowNumber: number
  fields: Record<string, string>
}

function decimal(value: string): string {
  let text = value.replace(/[$€£¥\s]/g, '')
  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text))
    text = text.replaceAll(',', '')
  else if (/^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}$/.test(text))
    text = text.replaceAll('.', '').replace(',', '.')
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) throw new Error('no es un número')
  return text.replace(/^\+/, '')
}

function fixed(value: string, scale: number): string {
  const [integer = '', fraction = ''] = decimal(value).split('.')
  if (fraction.slice(scale).replaceAll('0', ''))
    throw new Error(`admite como máximo ${scale} decimales`)
  const negative = integer.startsWith('-')
  const whole = integer.replace('-', '').replace(/^0+(?=\d)/, '')
  const tail = fraction.slice(0, scale).padEnd(scale, '0')
  return `${negative && /[1-9]/.test(whole + tail) ? '-' : ''}${whole}.${tail}`
}

function date(value: string): string {
  let result = value
  if (/^\d+$/.test(value)) {
    const serial = Number(value)
    if (serial < 1 || serial > 2958465 || serial === 60)
      throw new Error('no es una fecha válida')
    result = new Date(
      Date.UTC(1899, 11, 31) + (serial - (serial > 60 ? 1 : 0)) * 86400000,
    )
      .toISOString()
      .slice(0, 10)
  } else {
    const match = /^(\d{2})([/-])(\d{2})\2(\d{4})$/.exec(value)
    if (match) result = `${match[4]}-${match[3]}-${match[1]}`
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    !Number.isFinite(Date.parse(result)) ||
    new Date(result).toISOString().slice(0, 10) !== result
  )
    throw new Error('no es una fecha válida')
  return result
}

function convert(value: string, field: Field): unknown {
  if (field.type === 'money' || field.type === 'quantity')
    return fixed(value, field.scale ?? 2)
  if (field.type === 'number') {
    const number = Number(decimal(value))
    if (!Number.isFinite(number)) throw new Error('no es un número')
    return number
  }
  if (field.type === 'date') return date(value)
  if (field.type === 'boolean') {
    if (/^(sí|si|true|1)$/i.test(value)) return true
    if (/^(no|false|0)$/i.test(value)) return false
    throw new Error('debe ser sí, no, true, false, 1 o 0')
  }
  return value
}

const scaled = (value: string) => BigInt(value.replace('.', ''))
function total(quantity: string, price: string, discount: string): string {
  const value =
    scaled(quantity) * scaled(price) - scaled(discount) * BigInt(100000)
  const rounded =
    (value < BigInt(0) ? -BigInt(1) : BigInt(1)) *
    (((value < BigInt(0) ? -value : value) + BigInt(50000)) / BigInt(100000))
  const absolute = rounded < BigInt(0) ? -rounded : rounded
  return `${rounded < BigInt(0) ? '-' : ''}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, '0')}`
}

export function validateRows(
  rows: Record<string, string>[],
  mapping: Mapping,
  kind: Kind,
  ctx: { currency: string },
) {
  const mappingErrors = validateMapping(mapping, kind)
  if (mappingErrors.length) throw new Error(mappingErrors.join('; '))
  const ok: RowOk[] = []
  const errors: RowError[] = []
  rows.forEach((row, index) => {
    const rowNumber = index + 1
    const data: Record<string, unknown> = {}
    const fieldErrors: Record<string, string> = {}
    const error = (name: string, label: string, message: string) => {
      fieldErrors[name] = `Fila ${rowNumber}: ${label} ${message}`
    }
    for (const field of fields[kind]) {
      const header = mapping[field.name]
      const value = header ? row[header]?.trim() : undefined
      if (!value) {
        if (field.required) error(field.name, field.label, 'es obligatorio')
        continue
      }
      try {
        data[field.name] = convert(value, field)
      } catch (cause) {
        error(
          field.name,
          field.label,
          cause instanceof Error ? cause.message : 'no es válido',
        )
      }
    }
    if (kind === 'sales') {
      data.currency ??= ctx.currency
      data.discount ??= '0.00'
      if (
        typeof data.quantity === 'string' &&
        typeof data.unit_price === 'string' &&
        typeof data.discount === 'string'
      ) {
        const calculated = total(data.quantity, data.unit_price, data.discount)
        if (data.line_total === undefined && !fieldErrors.line_total)
          data.line_total = calculated
        else if (typeof data.line_total === 'string') {
          const difference = scaled(data.line_total) - scaled(calculated)
          if (difference > BigInt(1) || difference < -BigInt(1))
            error(
              'line_total',
              'total de línea',
              `no coincide con cantidad × precio − descuento (${calculated})`,
            )
        }
      }
    }
    const result = schemas[kind].safeParse(data)
    if (!result.success) {
      for (const issue of result.error.issues) {
        const name = String(issue.path[0])
        if (!fieldErrors[name])
          error(
            name,
            fields[kind].find((field) => field.name === name)?.label ?? name,
            issue.message,
          )
      }
    }
    if (Object.keys(fieldErrors).length)
      errors.push({ rowNumber, fields: fieldErrors })
    else if (result.success) ok.push({ rowNumber, data: result.data })
  })
  return {
    ok,
    errors,
    summary: { total: rows.length, valid: ok.length, invalid: errors.length },
  }
}
