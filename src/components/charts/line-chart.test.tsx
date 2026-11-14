import {
  render,
  screen,
  within,
  fireEvent,
  cleanup,
} from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { LineChart } from './line-chart'
afterEach(cleanup)
it('incluye resumen, tabla exacta y navegación por teclado con periodos desiguales', () => {
  render(
    <LineChart
      current={[{ day: '2026-11-01', net_sales: 123.45 }]}
      previous={[
        { day: '2026-10-01', net_sales: 99.5 },
        { day: '2026-10-02', net_sales: 42 },
      ]}
      currentLabel="1 nov 2026"
      previousLabel="1–2 oct 2026"
    />,
  )
  expect(screen.getByRole('img')).toHaveAttribute(
    'aria-label',
    expect.stringContaining('$123.45'),
  )
  fireEvent.click(screen.getByText('Ver tabla'))
  const table = screen.getByRole('table')
  expect(
    within(table).getByRole('cell', { name: /\$123.45/ }),
  ).toBeInTheDocument()
  expect(
    within(table).getByRole('cell', { name: /\$99.50/ }),
  ).toBeInTheDocument()
  expect(
    within(table).getByRole('cell', { name: /\$42.00/ }),
  ).toBeInTheDocument()
  expect(
    within(table).getByRole('cell', { name: /Sin dato/ }),
  ).toBeInTheDocument()
  const explorer = screen.getByRole('slider')
  fireEvent.focus(explorer)
  expect(screen.getByRole('status')).toHaveTextContent('2026-11-01: $123.45')
  fireEvent.keyDown(explorer, { key: 'ArrowRight' })
  expect(screen.getByRole('status')).toHaveTextContent(
    'Sin día equivalente: Sin dato',
  )
  expect(screen.getByRole('status')).toHaveTextContent('2026-10-02: $42.00')
})
it('presenta ceros y valores negativos sin geometría inválida', () => {
  const { container } = render(
    <LineChart
      current={[
        { day: '2026-11-01', net_sales: 0 },
        { day: '2026-11-02', net_sales: -10 },
      ]}
      previous={[]}
      currentLabel="noviembre"
      previousLabel="octubre"
    />,
  )
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
  expect(screen.getByRole('img')).toHaveAccessibleName(
    expect.stringContaining('−$10.00'),
  )
})
