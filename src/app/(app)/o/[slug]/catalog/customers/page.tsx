import { CatalogPage } from '@/features/imports/catalog-page'
export default function CustomersPage(props: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return <CatalogPage {...props} kind="customers" />
}
