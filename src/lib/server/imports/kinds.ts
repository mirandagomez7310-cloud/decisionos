import 'server-only'
import { z } from '@/lib/zod'

export type FieldType =
  'text' | 'number' | 'money' | 'quantity' | 'date' | 'boolean' | 'enum'
export interface Field {
  name: string
  label: string
  required: boolean
  type: FieldType
  synonyms: string[]
  scale?: number
}

function field(
  name: string,
  label: string,
  type: FieldType = 'text',
  required = false,
  aliases = '',
  scale?: number,
): Field {
  return {
    name,
    label,
    type,
    required,
    synonyms: [name, label, ...aliases.split('|')].filter(Boolean),
    scale,
  }
}
const sku = (name: string) =>
  field(
    name,
    'código de producto',
    'text',
    true,
    'sku|clave|código|codigo|product_code|item',
  )
const customer = () =>
  field(
    'customer_code',
    'código de cliente',
    'text',
    true,
    'cliente|customer|client_code',
  )
const ref = () =>
  field(
    'external_ref',
    'folio',
    'text',
    true,
    'referencia|factura|invoice|reference',
  )
const quantity = () =>
  field('quantity', 'cantidad', 'quantity', true, 'quantity|qty|existencias', 3)
const cost = () =>
  field('unit_cost', 'costo unitario', 'money', false, 'cost|costo', 4)
const active = () =>
  field('active', 'activo', 'boolean', false, 'active|habilitado')

export const fields = {
  products: [
    sku('sku'),
    field('name', 'nombre', 'text', true, 'product_name|producto|name'),
    field('category', 'categoría', 'text', false, 'category'),
    field('unit', 'unidad', 'text', false, 'unit'),
    field(
      'standard_cost',
      'costo estándar',
      'money',
      false,
      'standard_cost|cost|costo',
      4,
    ),
    field('list_price', 'precio de lista', 'money', false, 'price|precio', 4),
    active(),
  ],
  customers: [
    field(
      'code',
      'código',
      'text',
      true,
      'codigo|clave|customer_code|client_code',
    ),
    field('name', 'nombre', 'text', true, 'customer_name|cliente|name'),
    field('segment', 'segmento', 'text', false, 'segment'),
    field(
      'credit_limit',
      'límite de crédito',
      'money',
      false,
      'credit_limit',
      2,
    ),
    field(
      'payment_terms_days',
      'días de crédito',
      'number',
      false,
      'payment_terms|plazo',
    ),
    active(),
  ],
  sales: [
    ref(),
    field('sold_on', 'fecha de venta', 'date', true, 'fecha|date|sale_date'),
    customer(),
    field('customer_name', 'nombre del cliente', 'text', false, 'client_name'),
    sku('product_sku'),
    field(
      'product_name',
      'nombre del producto',
      'text',
      false,
      'producto|product',
    ),
    quantity(),
    field('unit_price', 'precio unitario', 'money', true, 'price|precio', 4),
    cost(),
    field('discount', 'descuento', 'money', false, 'discount', 2),
    field('line_total', 'total de línea', 'money', false, 'total|importe', 2),
    field('status', 'estado', 'enum', false, 'status'),
    field('currency', 'moneda', 'text', false, 'currency'),
    field('tax', 'impuesto', 'money', false, 'tax|iva', 2),
  ],
  inventory: [
    sku('product_sku'),
    field('snapshot_on', 'fecha de inventario', 'date', true, 'fecha|date'),
    quantity(),
    cost(),
  ],
  receivables: [
    ref(),
    customer(),
    field('issued_on', 'fecha de emisión', 'date', true, 'fecha|issue_date'),
    field(
      'due_on',
      'fecha de vencimiento',
      'date',
      true,
      'vencimiento|due_date',
    ),
    field('amount', 'importe', 'money', true, 'amount|monto|total', 2),
    field(
      'paid_amount',
      'importe pagado',
      'money',
      false,
      'paid|pagado|abonos',
      2,
    ),
    field(
      'sale_external_ref',
      'folio de venta',
      'text',
      false,
      'sale_reference',
    ),
  ],
} satisfies Record<string, Field[]>
export type Kind = keyof typeof fields

function schemaFor(kind: Kind) {
  const shape: Record<string, z.ZodType> = {}
  for (const f of fields[kind]) {
    let schema: z.ZodType
    if (f.type === 'money' || f.type === 'quantity') {
      schema = z
        .string()
        .regex(
          new RegExp(`^-?\\d+\\.\\d{${f.scale}}$`),
          'debe ser un decimal válido',
        )
        .refine(
          (value) => value.replace(/[-.]/g, '').replace(/^0+/, '').length <= 14,
          'supera la precisión permitida',
        )
      if (kind === 'sales' && f.name === 'quantity')
        schema = schema.refine(
          (value) => typeof value === 'string' && !/^-?0+\.0+$/.test(value),
          'no puede ser cero',
        )
      if (kind === 'sales' && f.name === 'unit_price')
        schema = schema.refine(
          (value) => typeof value === 'string' && !value.startsWith('-'),
          'no puede ser negativo',
        )
    } else if (f.type === 'number')
      schema = z
        .number()
        .int('debe ser un número entero')
        .min(0, 'no puede ser negativo')
        .max(2147483647, 'supera el máximo permitido')
    else if (f.type === 'boolean') schema = z.boolean()
    else if (f.type === 'date') schema = z.iso.date('debe ser una fecha válida')
    else if (f.type === 'enum')
      schema = z.enum(
        ['completed', 'cancelled', 'returned'],
        'debe ser completed, cancelled o returned',
      )
    else schema = z.string().min(1, 'es obligatorio')
    if (f.name === 'currency')
      schema = z
        .string()
        .regex(/^[A-Z]{3}$/, 'debe tener tres letras mayúsculas')
    if (f.name === 'active') schema = schema.default(true)
    else if (f.name === 'status') schema = schema.default('completed')
    else if (f.name === 'discount' || f.name === 'paid_amount')
      schema = schema.default('0.00')
    else if (!f.required) schema = schema.optional()
    shape[f.name] = schema
  }
  return z.object(shape).superRefine((row, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message })
    if (
      kind === 'receivables' &&
      typeof row.amount === 'string' &&
      /^-?\d+\.\d{2}$/.test(row.amount) &&
      typeof row.paid_amount === 'string' &&
      /^-?\d+\.\d{2}$/.test(row.paid_amount)
    ) {
      const amount = BigInt(row.amount.replace('.', ''))
      const paid = BigInt(row.paid_amount.replace('.', ''))
      if (amount <= BigInt(0)) issue('amount', 'debe ser mayor que cero')
      if (paid < BigInt(0) || paid > amount)
        issue('paid_amount', 'debe estar entre cero y el importe')
    }
  })
}
export const schemas = {
  products: schemaFor('products'),
  customers: schemaFor('customers'),
  sales: schemaFor('sales'),
  inventory: schemaFor('inventory'),
  receivables: schemaFor('receivables'),
}
