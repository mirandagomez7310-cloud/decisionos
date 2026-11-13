import { describe, expect, it } from 'vitest'
import {
  catalogFilter,
  catalogSearchSchema,
  importSchema,
  kindSchema,
  mappingSchema,
  sanitizeFilename,
  uploadSchema,
} from './schemas'
const organizationId = '11111111-1111-4111-8111-111111111111'
describe('esquemas de importación', () => {
  it('protege el filtro sin perder puntuación en códigos o nombres', () => {
    expect(catalogFilter('A,B.1', 'sku')).toBe(
      'sku.ilike."%A,B.1%",name.ilike."%A,B.1%"',
    )
    const pattern = JSON.stringify('%A\\%\\_\\\\"(B)%')
    expect(catalogFilter('A%_\\"(B)', 'code')).toBe(
      `code.ilike.${pattern},name.ilike.${pattern}`,
    )
  })
  it('admite los cinco tipos y rechaza tipos desconocidos', () => {
    for (const kind of [
      'products',
      'customers',
      'sales',
      'inventory',
      'receivables',
    ])
      expect(kindSchema.safeParse(kind).success).toBe(true)
    expect(kindSchema.safeParse('other').success).toBe(false)
  })
  it('exige identificadores UUID', () => {
    expect(
      importSchema.safeParse({ organizationId, importId: organizationId })
        .success,
    ).toBe(true)
    expect(
      importSchema.safeParse({
        organizationId: 'otro',
        importId: organizationId,
      }).success,
    ).toBe(false)
  })
  it('valida extensión, contenido y límite de tamaño', () => {
    const parse = (file: File) =>
      uploadSchema.safeParse({ organizationId, kind: 'products', file }).success
    expect(parse(new File(['sku,name\nA,Uno'], 'PRODUCTS.CSV'))).toBe(true)
    expect(parse(new File(['datos'], 'products.xlsx'))).toBe(true)
    expect(parse(new File([], 'empty.csv'))).toBe(false)
    expect(parse(new File(['datos'], 'old.xls'))).toBe(false)
    const large = new File(['datos'], 'large.csv')
    Object.defineProperty(large, 'size', {
      value: 25 * 1024 * 1024,
      configurable: true,
    })
    expect(parse(large)).toBe(true)
    Object.defineProperty(large, 'size', { value: 25 * 1024 * 1024 + 1 })
    expect(parse(large)).toBe(false)
  })
  it('acepta columnas opcionales sin asignar y rechaza valores no textuales', () => {
    expect(mappingSchema.safeParse({ sku: 'Código', unit: null }).success).toBe(
      true,
    )
    expect(mappingSchema.safeParse({ sku: 1 }).success).toBe(false)
  })
  it('sanea rutas y conserva extensión con un nombre acotado', () => {
    expect(sanitizeFilename('../archivo con espacios.csv')).toBe(
      '.._archivo_con_espacios.csv',
    )
    expect(sanitizeFilename('a'.repeat(300) + '.xlsx')).toHaveLength(180)
    expect(sanitizeFilename('a'.repeat(300) + '.xlsx')).toMatch(/\.xlsx$/)
    for (const name of [
      '../archivo con espacios.csv',
      'ñ_日本.xlsx',
      'a'.repeat(300) + '.xlsx',
    ])
      expect(
        `${organizationId}/${organizationId}-${sanitizeFilename(name)}`,
      ).toMatch(new RegExp(`^${organizationId}/[0-9a-f-]{36}-[A-Za-z0-9._-]+$`))
  })
  it('valida orden y paginación del catálogo', () => {
    expect(catalogSearchSchema.parse({})).toEqual({
      q: '',
      page: 1,
      pageSize: 20,
      sort: 'name',
    })
    expect(
      catalogSearchSchema.parse({ q: ' A ', page: '2', sort: '-code' }).q,
    ).toBe('A')
    for (const input of [
      { page: 0 },
      { pageSize: 101 },
      { sort: 'password' },
      { q: ['A'] },
    ])
      expect(catalogSearchSchema.safeParse(input).success).toBe(false)
  })
})
