import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/supabase/types'

const slug = 'distribuidora-demo'
const email = 'demo@decisionos.local'
const password = 'demo-decisionos-2026'
const loopback = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?\/?$/

async function checked<T>(
  operation: string,
  query: PromiseLike<{ data: T; error: { message: string } | null }>,
) {
  const { data, error } = await query
  if (error) throw new Error(`${operation}: ${error.message}`)
  return data
}

async function seed() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: key } =
    process.env
  if (!url || !loopback.test(url) || !key?.trim())
    throw new Error(
      'Se requieren una URL HTTP de Supabase local y su clave de servicio.',
    )

  const db = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, redirect: 'error' }),
    },
  })
  let user
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 100,
    })
    if (error) throw new Error(`Buscar la cuenta demo: ${error.message}`)
    user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email,
    )
    if (user || !data.nextPage) break
  }
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) throw new Error(`Crear la cuenta demo: ${error.message}`)
    user = data.user
  }
  assert(user, 'La cuenta demo debe existir antes de cargar los datos.')

  await checked(
    'Borrar la organización demo anterior',
    db.from('organizations').delete().eq('slug', slug),
  )
  const organization = await checked(
    'Crear la organización demo',
    db
      .from('organizations')
      .insert({ name: 'Distribuidora Demo', slug })
      .select('id')
      .single(),
  )
  assert(
    organization,
    'La organización demo debe existir antes de cargar los datos.',
  )
  const organization_id = organization.id
  await checked(
    'Asignar el owner',
    db.from('memberships').insert({
      organization_id,
      user_id: user.id,
      role: 'owner',
    }),
  )

  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const dateAgo = (days: number) =>
    new Date(Date.parse(today) - days * 86_400_000).toISOString().slice(0, 10)
  const monthStart = new Date(today)
  monthStart.setUTCDate(1)
  monthStart.setUTCMonth(monthStart.getUTCMonth() - 1)
  const lastMonth = monthStart.toISOString().slice(0, 7)
  monthStart.setUTCMonth(monthStart.getUTCMonth() - 1)
  const previousMonth = monthStart.toISOString().slice(0, 7)

  let state = 2026
  function pick(max: number) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return Math.floor((state / 2 ** 32) * max)
  }

  const categories = [
    'Abarrotes',
    'Bebidas',
    'Limpieza',
    'Desechables',
    'Higiene',
  ]
  const products = categories.flatMap((category, group) =>
    Array.from({ length: 8 }, (_, index) => ({
      id: randomUUID(),
      organization_id,
      sku: `P-${group * 8 + index + 1}`,
      name: `${category} · Producto ${index + 1}`,
      category,
      unit: 'pieza',
      standard_cost: 50,
      list_price: group === 0 && index === 0 ? 40 : 80,
    })),
  )
  const customers = Array.from({ length: 25 }, (_, index) => ({
    id: randomUUID(),
    organization_id,
    code: `C-${index + 1}`,
    name: `Cliente ${index + 1}`,
    credit_limit: index === 0 ? 10000 : 20000,
    payment_terms_days: 30,
  }))
  const entries = Array.from({ length: 181 }, (_, day) => {
    const age = 180 - day
    const sold_on = dateAgo(age)
    return categories.map((_, group) => {
      const product = products[group * 8 + pick(age >= 90 ? 8 : 6)]!
      const customer =
        customers[group < 3 ? (day + group) % 5 : 5 + ((day + group) % 20)]!
      const id = randomUUID()
      const declining = group === 0 && sold_on.startsWith(lastMonth)
      // Mismo volumen por categoría: si una domina, su caída arrastra el total del mes.
      const quantity = (declining ? 8 : 20) + pick(3)
      const total = quantity * product.list_price
      const index = day * categories.length + group
      const unit_cost =
        (index + Math.floor(index / 10)) % 10 === 9
          ? null
          : product.standard_cost
      return {
        sale: {
          id,
          organization_id,
          sold_on,
          customer_id: customer.id,
          external_ref: `DEMO-V-${index + 1}`,
          status: 'completed',
          currency: 'MXN',
          subtotal: total,
          tax: 0,
          total,
        },
        line: {
          organization_id,
          sale_id: id,
          product_id: product.id,
          quantity,
          unit_price: product.list_price,
          unit_cost,
          discount: 0,
          line_total: total,
        },
      }
    })
  }).flat()
  const inventory = products.map((product) => ({
    organization_id,
    product_id: product.id,
    snapshot_on: today,
    quantity: 100,
    unit_cost: product.standard_cost,
  }))
  const receivables = customers.map((customer, index) => ({
    organization_id,
    customer_id: customer.id,
    external_ref: `DEMO-CXC-${index + 1}`,
    issued_on: dateAgo(index === 0 ? 135 : 10 + index),
    due_on: dateAgo(index === 0 ? 105 : index - 20),
    amount: index === 0 ? 15000 : 1000 + pick(3000),
    paid_amount: index === 0 ? 0 : 250,
  }))

  const categoryIds = new Set(products.slice(0, 8).map(({ id }) => id))
  const leadingIds = new Set(customers.slice(0, 5).map(({ id }) => id))
  const categorySales = (month: string) =>
    entries.reduce(
      (total, { sale, line }) =>
        sale.sold_on.startsWith(month) && categoryIds.has(line.product_id)
          ? total + sale.total
          : total,
      0,
    )
  assert(categorySales(lastMonth) < categorySales(previousMonth) * 0.8)
  const lastMonthEntries = entries.filter(({ sale }) =>
    sale.sold_on.startsWith(lastMonth),
  )
  assert(
    lastMonthEntries.some(
      ({ line }) =>
        line.product_id === products[0]!.id &&
        (line.unit_cost ?? 0) > line.unit_price,
    ),
  )
  assert(
    entries.reduce(
      (total, { sale }) =>
        total + (leadingIds.has(sale.customer_id) ? sale.total : -sale.total),
      0,
    ) > 0,
  )
  const recentProducts = new Set(
    entries
      .filter(({ sale }) => sale.sold_on >= dateAgo(89))
      .map(({ line }) => line.product_id),
  )
  assert.equal(
    inventory.filter(({ product_id }) => !recentProducts.has(product_id))
      .length,
    10,
  )

  await checked('Insertar productos', db.from('products').insert(products))
  await checked('Insertar clientes', db.from('customers').insert(customers))
  for (let offset = 0; offset < entries.length; offset += 500) {
    const batch = entries.slice(offset, offset + 500)
    await checked(
      'Insertar ventas',
      db.from('sales').insert(batch.map(({ sale }) => sale)),
    )
    await checked(
      'Insertar líneas',
      db.from('sale_lines').insert(batch.map(({ line }) => line)),
    )
  }
  await checked(
    'Insertar existencias',
    db.from('inventory_snapshots').insert(inventory),
  )
  await checked(
    'Insertar cuentas por cobrar',
    db.from('receivables').insert(receivables),
  )
  const counts = {
    productos: products.length,
    clientes: customers.length,
    ventas: entries.length,
    líneas: entries.length,
    existencias: inventory.length,
    cuentas: receivables.length,
  }
  await checked(
    'Registrar auditoría',
    db.from('audit_log').insert({
      organization_id,
      actor_kind: 'system',
      action: 'demo.seeded',
      entity: 'organizations',
      entity_id: organization_id,
      data: counts,
    }),
  )
  await checked('Encolar insights diarios', db.rpc('enqueue_daily_insights'))

  const { APP_URL: appUrl = 'http://127.0.0.1:3000', CRON_SECRET: cronSecret } =
    process.env
  try {
    if (!loopback.test(appUrl) || !cronSecret)
      throw new Error('Se requieren APP_URL local y CRON_SECRET.')
    const response = await fetch(new URL('/api/jobs/run', appUrl), {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  } catch (error) {
    console.warn(
      'Insights en cola: se calcularán cuando arranque la app y llegue el siguiente barrido.',
      (error as Error).message,
    )
  }

  console.table(counts)
  console.log(`Demo: ${email} / ${password}`)
}

seed().catch((error: unknown) => {
  console.error(
    'Error al cargar la demo:',
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
})
