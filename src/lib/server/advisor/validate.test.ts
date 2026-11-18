import { expect, it } from 'vitest'
import {
  formatMoney,
  formatPercent,
  formatPercentChange,
  formatPoints,
} from '@/lib/format'
import type { AdviceItem } from '../ai/schema'
import { advisorInputHash, type AdvisorFact } from './facts'
import { renderAdvice } from './render'
import { validateAdvice } from './validate'

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const otherId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const unknownId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const fact: AdvisorFact = {
  id,
  rule_key: 'sales_drop',
  severity: 'critical',
  module: 'sales',
  title: 'Ventas',
  body: 'Datos de ventas',
  metric_snapshot: { net_sales: 1234.56, coverage: 85.25, margin_pct: null },
}
const facts = [fact, { ...fact, id: otherId }]
const item: AdviceItem = {
  kind: 'suggestion',
  priority: 5,
  title: `Ventas de {{${id}.net_sales}}`,
  body: `Revisa la cobertura del {{${id}.coverage}}`,
  cites: [id],
}

it.each([
  { body: 'Revisa 2 indicadores' },
  { title: 'Revisa 2 indicadores' },
  { body: 'Revisa 1,000 ventas' },
  { body: 'Revisa 12.5 ventas' },
  { body: `Revisa {{${unknownId}.net_sales}}` },
  { body: `Revisa {{${otherId}.net_sales}}` },
  { body: `Revisa {{${id}.unknown}}` },
  { body: `Revisa {{${id}.margin_pct}}` },
  { body: `Revisa {{${id}.prev_net_sales}}` },
  { body: `{{${id}.net_sales}}{{${id}.coverage}}` },
  { cites: [id, unknownId] },
  { body: 'Revisa １２ ventas' },
  { body: 'Las ventas cayeron diez puntos' },
  { body: 'Duplica: vende el doble que antes' },
  { title: 'La mitad del inventario no rota' },
  { body: 'Sube un cinco por ciento' },
  { body: 'Cobra mil pesos pendientes' },
  { body: 'Doscientos clientes vencidos' },
])('descarta el elemento inválido %#', (change) => {
  expect(
    validateAdvice({ items: [item, { ...item, ...change }] }, facts),
  ).toEqual({ items: [item], rejected: 1 })
})

it('acepta palabras que contienen numerales sin serlo', () => {
  const text = 'Todos los clientes, ciencia y milagros: revisa la mayoría'
  expect(
    validateAdvice({ items: [{ ...item, body: text }] }, facts).items,
  ).toHaveLength(1)
})

it('renderiza el dinero y porcentaje desde los valores originales', () => {
  expect(renderAdvice(item, facts)).toEqual({
    title: `Ventas de ${formatMoney(1234.56)}`,
    body: `Revisa la cobertura del ${formatPercent(85.25)}`,
    metric_snapshot: {
      [`${id}.net_sales`]: 1234.56,
      [`${id}.coverage`]: 85.25,
    },
  })
})

it('todo grupo de dígitos renderizado pertenece a una cifra citada', () => {
  for (const value of [-1234.56, -0.2, 0, 0.3, 987654.32]) {
    const currentFacts = [
      {
        ...fact,
        metric_snapshot: {
          net_sales: value,
          coverage: value,
          net_sales_change_pct: value,
          margin_pct_change_pts: value,
        },
      },
    ]
    const candidate = {
      ...item,
      body: `Variación de {{${id}.net_sales_change_pct}} y {{${id}.margin_pct_change_pts}}`,
      title: `{{${id}.net_sales}} al {{${id}.coverage}}`,
    }
    const accepted = validateAdvice({ items: [candidate] }, currentFacts)
    expect(accepted.rejected).toBe(0)
    for (const acceptedItem of accepted.items) {
      const { title, body } = renderAdvice(acceptedItem, currentFacts)
      const citedDigits = [
        formatMoney,
        formatPercent,
        formatPercentChange,
        formatPoints,
      ].flatMap((format) => format(value).match(/\d+/g) ?? [])
      for (const digits of (title + ' ' + body).match(/\d+/g) ?? []) {
        expect(citedDigits).toContain(digits)
      }
    }
  }
})

it('el hash solo depende de los ids y cifras, sin depender del orden', () => {
  const hash = advisorInputHash(facts)
  expect(hash).toMatch(/^[a-f0-9]{64}$/)
  expect(
    advisorInputHash([
      facts[1]!,
      {
        ...fact,
        title: 'Otro título',
        metric_snapshot: {
          margin_pct: null,
          coverage: 85.25,
          net_sales: 1234.56,
        },
      },
    ]),
  ).toBe(hash)
  expect(
    advisorInputHash([
      { ...fact, metric_snapshot: { ...fact.metric_snapshot, net_sales: 1 } },
      facts[1]!,
    ]),
  ).not.toBe(hash)
})
