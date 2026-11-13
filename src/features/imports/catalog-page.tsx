import Link from 'next/link'
import { requireRole } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import { catalogSearchSchema, catalogFilter } from './schemas'
export async function CatalogPage({
  params,
  searchParams,
  kind,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
  kind: 'products' | 'customers'
}) {
  const { slug } = await params
  const { organization } = await requireRole(
    slug,
    'owner',
    'admin',
    'analyst',
    'viewer',
  )
  const parsed = catalogSearchSchema.safeParse(await searchParams)
  const title = kind === 'products' ? 'Productos' : 'Clientes'
  if (!parsed.success)
    return (
      <>
        <h1>{title}</h1>
        <p role="alert">Parámetros de consulta inválidos.</p>
        <Link href={`/o/${slug}/catalog/${kind}`}>Restablecer consulta</Link>
      </>
    )
  const { q, page, pageSize, sort } = parsed.data
  const code = kind === 'products' ? 'sku' : 'code'
  const field = sort.replace('-', '') === 'code' ? code : sort.replace('-', '')
  const db = await createClient()
  let query = db
    .from(kind)
    .select('*', { count: 'exact' })
    .eq('organization_id', organization.id)
  if (q) query = query.or(catalogFilter(q, code))
  const { data, count, error } = await query
    .order(field, { ascending: !sort.startsWith('-') })
    .order('id')
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (error) throw new Error('No pudimos consultar el catálogo.')
  const href = (nextPage: number, nextSort = sort, nextSize = pageSize) =>
    '?' +
    new URLSearchParams({
      q,
      page: String(nextPage),
      pageSize: String(nextSize),
      sort: nextSort,
    })
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <nav aria-label="Catálogo" className="flex gap-4">
        <Link className="underline" href={`/o/${slug}/catalog/products`}>
          Productos
        </Link>
        <Link className="underline" href={`/o/${slug}/catalog/customers`}>
          Clientes
        </Link>
      </nav>
      <form className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q">
            Buscar por {code === 'sku' ? 'SKU' : 'código'} o nombre
          </label>
          <input
            className="block border p-2"
            id="q"
            name="q"
            defaultValue={q}
            maxLength={200}
          />
        </div>
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="pageSize" value={pageSize} />
        <button className="rounded border px-4 py-2">Buscar</button>
      </form>
      <nav
        aria-label="Orden y tamaño de página"
        className="flex flex-wrap gap-3"
      >
        {(['code', 'name', 'created_at'] as const).map((key, index) => (
          <Link
            key={key}
            className="underline"
            href={href(1, sort === key ? `-${key}` : key)}
          >
            {
              [code === 'sku' ? 'SKU' : 'Código', 'Nombre', 'Fecha de alta'][
                index
              ]
            }
            {sort.replace('-', '') === key
              ? sort.startsWith('-')
                ? ' ↓'
                : ' ↑'
              : ''}
          </Link>
        ))}
        {[20, 50, 100].map((size) => (
          <Link key={size} className="underline" href={href(1, sort, size)}>
            {size.toLocaleString('es-MX')} por página
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">
            Catálogo de {title.toLowerCase()}
          </caption>
          <thead>
            <tr>
              {[
                code === 'sku' ? 'SKU' : 'Código',
                'Nombre',
                'Activo',
                'Fecha de alta',
              ].map((label) => (
                <th className="p-2" scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <th className="p-2" scope="row">
                  {'sku' in row ? row.sku : row.code}
                </th>
                <td className="p-2">{row.name}</td>
                <td className="p-2">{row.active ? 'Sí' : 'No'}</td>
                <td className="p-2">
                  {new Date(row.created_at).toLocaleString('es-MX')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.length && <p>No hay resultados.</p>}
      <nav aria-label="Paginación" className="flex gap-4">
        {page > 1 && (
          <Link className="underline" href={href(page - 1)}>
            Anterior
          </Link>
        )}
        <span>
          Página {page.toLocaleString('es-MX')} de{' '}
          {Math.max(1, Math.ceil((count ?? 0) / pageSize)).toLocaleString(
            'es-MX',
          )}
        </span>
        {page * pageSize < (count ?? 0) && (
          <Link className="underline" href={href(page + 1)}>
            Siguiente
          </Link>
        )}
      </nav>
    </div>
  )
}
