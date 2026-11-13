import { requireRole } from '@/features/organizations/queries'
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { organization, role } = await requireRole(
    (await params).slug,
    'owner',
    'admin',
    'analyst',
    'viewer',
  )
  return (
    <>
      <h1 className="text-2xl font-semibold">Panel de {organization.name}</h1>
      <p className="mt-4">Tu rol: {role}</p>
    </>
  )
}
