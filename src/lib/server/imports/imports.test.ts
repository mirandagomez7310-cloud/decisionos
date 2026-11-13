// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseFile } from './parse'
import { suggestMapping, validateMapping } from './mapping'
import { validateRows } from './validate'
import { fields, schemas, type Kind } from './kinds'

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url))
const ctx = { currency: 'MXN' }
const sale = {
  external_ref: 'F1',
  sold_on: '2026-11-12',
  customer_code: 'C1',
  product_sku: 'P1',
  quantity: '2',
  unit_price: '$1,234.50',
}
function validate(row: Record<string, string>, kind: Kind = 'sales') {
  return validateRows(
    [row],
    Object.fromEntries(fields[kind].map((field) => [field.name, field.name])),
    kind,
    ctx,
  )
}

describe('parseFile', () => {
  it('lee UTF-8 con BOM y Windows-1252 con aviso', async () => {
    for (const name of ['bom.csv', 'latin1.csv']) {
      const result = await parseFile(fixture(name), name)
      expect(result.headers).toEqual(['sku', 'nombre'])
      expect(result.rows).toEqual([{ sku: 'A1', nombre: 'Café' }])
      expect(result.warnings).toHaveLength(name === 'latin1.csv' ? 1 : 0)
    }
  })
  it('autodetecta punto y coma, tabulador y respeta comillas y saltos', async () => {
    expect(
      (await parseFile(fixture('semicolon.csv'), 'a.csv')).rows[0]?.precio,
    ).toBe('1.234,50')
    expect(
      (await parseFile(Buffer.from('sku\tnombre\nA1\tCafé'), 'a.csv')).headers,
    ).toEqual(['sku', 'nombre'])
    expect(
      (await parseFile(Buffer.from('sku,nombre\nA1,"Café,\ndoble"'), 'a.csv'))
        .rows[0]?.nombre,
    ).toBe('Café,\ndoble')
  })
  it.each([
    '',
    '  ',
    'sku,nombre',
    ',nombre\nA1,Café',
    'sku,SKU\nA1,B1',
    'sku,sku\nA1,B1',
    'sku,nombre\nA1,Café,extra',
    'sku,nombre\n"sin cierre',
  ])(
    'rechaza CSV vacío, sin cabecera válida o mal formado: %s',
    async (content) => {
      await expect(parseFile(Buffer.from(content), 'a.csv')).rejects.toThrow()
    },
  )
  it('rechaza formatos y tamaños fuera del presupuesto', async () => {
    await expect(parseFile(Buffer.from('x'), 'a.xls')).rejects.toThrow(
      'Guarda el archivo como .xlsx',
    )
    await expect(parseFile(Buffer.from('x'), 'a.txt')).rejects.toThrow(
      'Formato no admitido',
    )
    await expect(
      parseFile(Buffer.alloc(25 * 1024 * 1024 + 1), 'a.csv'),
    ).rejects.toThrow('25 MiB')
    const content = 'sku\n' + 'A\n'.repeat(100_000)
    expect((await parseFile(Buffer.from(content), 'a.csv')).rows).toHaveLength(
      100_000,
    )
    await expect(
      parseFile(Buffer.from(content + 'B'), 'a.csv'),
    ).rejects.toThrow('100 000')
  })
  it('lee solo la primera hoja de Excel y convierte fechas y celdas', async () => {
    const result = await parseFile(fixture('minimal.xlsx'), 'a.xlsx')
    expect(result.headers).toEqual(['sku', 'fecha', 'cantidad', 'activo'])
    expect(result.rows).toEqual([
      { sku: 'A1', fecha: '2024-01-01', cantidad: '1.250', activo: 'true' },
    ])
    expect(result.warnings).toEqual([])
  })
})

describe('mapeo', () => {
  it('sugiere sinónimos en español, inglés, con acentos y separadores', () => {
    expect(
      suggestMapping(
        ['Código de Producto', 'NOMBRE', 'Precio-de_lista'],
        'products',
      ),
    ).toMatchObject({
      sku: 'Código de Producto',
      name: 'NOMBRE',
      list_price: 'Precio-de_lista',
      category: null,
    })
    expect(suggestMapping(['product_code', 'name'], 'products').sku).toBe(
      'product_code',
    )
  })
  it('no adivina ante ambigüedad ni reutiliza columnas', () => {
    expect(suggestMapping(['sku', 'clave'], 'products').sku).toBeNull()
    expect(validateMapping({ sku: 'a', name: 'a' }, 'products')).toEqual([
      expect.stringContaining('dos veces'),
    ])
    expect(validateMapping({}, 'products')).toHaveLength(2)
    expect(() => validateRows([], {}, 'products', ctx)).toThrow('Falta asignar')
  })
})

describe('validación', () => {
  it('normaliza dinero, calcula el total y aplica defaults', () => {
    expect(validate(sale).ok[0]).toEqual({
      rowNumber: 1,
      data: {
        ...sale,
        quantity: '2.000',
        unit_price: '1234.5000',
        discount: '0.00',
        line_total: '2469.00',
        status: 'completed',
        currency: 'MXN',
      },
    })
    expect(
      validate({ ...sale, unit_price: '1.234,50' }).ok[0]?.data.unit_price,
    ).toBe('1234.5000')
    expect(
      validate({ ...sale, quantity: '0.1', unit_price: '0.2' }).ok[0]?.data
        .line_total,
    ).toBe('0.02')
    expect(
      validate({ ...sale, quantity: '-1', unit_price: '0.005' }).ok[0]?.data
        .line_total,
    ).toBe('-0.01')
  })
  it('tolera un centavo, rechaza diferencias mayores y respeta descuentos', () => {
    expect(validate({ ...sale, line_total: '2469.01' }).errors).toEqual([])
    expect(validate({ ...sale, line_total: '2468.99' }).errors).toEqual([])
    expect(
      validate({ ...sale, line_total: '2469.02' }).errors[0]?.fields.line_total,
    ).toContain('no coincide')
    expect(validate({ ...sale, discount: '9' }).ok[0]?.data.line_total).toBe(
      '2460.00',
    )
  })
  it.each(['2024-01-01', '01/01/2024', '01-01-2024', '45292'])(
    'convierte fecha %s',
    (sold_on) => {
      expect(validate({ ...sale, sold_on }).ok[0]?.data.sold_on).toBe(
        '2024-01-01',
      )
    },
  )
  it.each(['31/02/2024', '2023-02-29', '60', '0', '2958466', 'ayer'])(
    'rechaza fecha imposible %s',
    (sold_on) => {
      expect(
        validate({ ...sale, sold_on }).errors[0]?.fields.sold_on,
      ).toContain('fecha válida')
    },
  )
  it('acumula errores por campo y numera desde la primera fila de datos', () => {
    const rows = [
      sale,
      { ...sale, quantity: 'abc', unit_price: '-1', status: 'otro' },
    ]
    const result = validateRows(
      rows,
      suggestMapping(Object.keys(sale).concat('status'), 'sales'),
      'sales',
      ctx,
    )
    expect(result.summary).toEqual({ total: 2, valid: 1, invalid: 1 })
    expect(result.errors[0]).toMatchObject({
      rowNumber: 2,
      fields: {
        quantity: 'Fila 2: cantidad no es un número',
        unit_price: expect.any(String),
        status: expect.any(String),
      },
    })
  })
  it.each(['sí', 'si', 'true', '1', 'no', 'false', '0'])(
    'convierte booleano %s',
    (active) => {
      expect(
        validate({ sku: 'A', name: ' Café ', active }, 'products').ok[0]?.data,
      ).toMatchObject({
        name: 'Café',
        active: ['sí', 'si', 'true', '1'].includes(active),
      })
    },
  )
  it('valida catálogos, inventario y cuentas por cobrar', () => {
    expect(
      validate({ sku: 'A', name: 'Café' }, 'products').ok[0]?.data.active,
    ).toBe(true)
    expect(
      validate({ code: 'C', name: 'Cliente' }, 'customers').ok[0]?.data.active,
    ).toBe(true)
    expect(
      validate(
        { code: 'C', name: 'Cliente', payment_terms_days: '1.5' },
        'customers',
      ).errors,
    ).toHaveLength(1)
    expect(
      validate(
        { product_sku: 'A', snapshot_on: '2024-01-01', quantity: '-2.125' },
        'inventory',
      ).ok,
    ).toHaveLength(1)
    const row = {
      external_ref: 'F',
      customer_code: 'C',
      issued_on: '2024-01-01',
      due_on: '2024-02-01',
      amount: '10',
    }
    expect(validate(row, 'receivables').ok[0]?.data.paid_amount).toBe('0.00')
    expect(
      validate({ ...row, paid_amount: '11' }, 'receivables').errors[0]?.fields
        .paid_amount,
    ).toContain('entre cero')
    expect(
      validate({ ...row, amount: '0' }, 'receivables').errors,
    ).toHaveLength(1)
  })
  it.each(['1,23,4', 'NaN', 'Infinity', '1e3', '99999999999.0001', '1.00001'])(
    'rechaza dinero inválido o fuera de precisión %s',
    (unit_price) => {
      expect(validate({ ...sale, unit_price }).errors).toHaveLength(1)
    },
  )
  it('los esquemas rechazan directamente filas mapeadas inválidas', () => {
    expect(schemas.products.safeParse({ sku: '', name: 'Café' }).success).toBe(
      false,
    )
    expect(
      validate({ sku: 'A', name: 'Café', active: 'quizás' }, 'products').errors,
    ).toHaveLength(1)
    expect(validate({ ...sale, quantity: '0' }).errors).toHaveLength(1)
    expect(validate({ ...sale, currency: 'pesos' }).errors).toHaveLength(1)
    expect(validate({ ...sale, product_sku: '' }).errors).toHaveLength(1)
  })
})
