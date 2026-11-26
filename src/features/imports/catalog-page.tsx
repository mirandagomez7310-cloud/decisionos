import Link from 'next/link'
import {
  AnalysisHeading,
  AnalysisPagination,
  AnalysisTable,
  QueryAlert,
  SearchField,
  SortHeader,
} from '@/features/analysis/components'
import { requireRole } from '@/lib/server/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/format'
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
        <AnalysisHeading title={title} />
        <QueryAlert
          href={`/o/${slug}/catalog/${kind}`}
          label="Restablecer consulta"
        >
          Parámetros de consulta inválidos.
        </QueryAlert>
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
  const total = count ?? 0
  const codeLabel = code === 'sku' ? 'SKU' : 'Código'
  const header = (label: string, key: 'code' | 'name' | 'created_at') => (
    <SortHeader
      label={label}
      href={href(1, sort === key ? `-${key}` : key)}
      direction={
        sort.replace('-', '') === key
          ? sort.startsWith('-')
            ? 'descending'
            : 'ascending'
          : undefined
      }
    />
  )
  return (
    <>
      <AnalysisHeading title={title}>
        {total.toLocaleString('es-MX')}{' '}
        {kind === 'products' ? 'productos' : 'clientes'} importados
      </AnalysisHeading>
      <div className="analysis-controls">
        <nav aria-label="Catálogo" className="analysis-switch">
          {(['products', 'customers'] as const).map((item) => (
            <Link
              key={item}
              href={`/o/${slug}/catalog/${item}`}
              aria-current={item === kind ? 'page' : undefined}
            >
              {item === 'products' ? 'Productos' : 'Clientes'}
            </Link>
          ))}
        </nav>
        <form className="analysis-search">
          <SearchField
            label={`Buscar por ${code === 'sku' ? 'SKU' : 'código'} o nombre`}
            defaultValue={q}
            maxLength={200}
          />
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="pageSize" value={pageSize} />
          <button className="action-button compact">Buscar</button>
        </form>
      </div>
      {data.length ? (
        <AnalysisTable
          label={`Catálogo de ${title.toLowerCase()}`}
          className="text-table"
        >
          <thead>
            <tr>
              {header('Nombre', 'name')}
              {header(codeLabel, 'code')}
              <SortHeader label="Estado" />
              {header('Fecha de alta', 'created_at')}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <span>{row.name}</span>
                </th>
                <td>{'sku' in row ? row.sku : row.code}</td>
                <td>
                  {row.active ? (
                    'Activo'
                  ) : (
                    <span className="status-chip">Inactivo</span>
                  )}
                </td>
                <td>{formatDateTime(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </AnalysisTable>
      ) : q ? (
        <p>
          Ningún {kind === 'products' ? 'producto' : 'cliente'} coincide con «
          {q}».{' '}
          <Link
            className="underline"
            href={
              '?' + new URLSearchParams({ pageSize: String(pageSize), sort })
            }
          >
            Quitar búsqueda
          </Link>
        </p>
      ) : (
        <p>
          Aún no hay {title.toLowerCase()}. Se crean al importar{' '}
          <Link className="underline" href={`/o/${slug}/imports/new`}>
            un catálogo o ventas
          </Link>
          .
        </p>
      )}
      <div className="catalog-footer">
        <AnalysisPagination
          page={page}
          pages={Math.max(1, Math.ceil(total / pageSize))}
          count={total}
          href={(next) => href(next)}
        />
        <nav aria-label="Filas por página" className="analysis-switch">
          {[20, 50, 100].map((size) => (
            <Link
              key={size}
              href={href(1, sort, size)}
              aria-current={size === pageSize ? 'page' : undefined}
              aria-label={`${size} por página`}
            >
              {size}
            </Link>
          ))}
        </nav>
      </div>
    </>
  )
}
