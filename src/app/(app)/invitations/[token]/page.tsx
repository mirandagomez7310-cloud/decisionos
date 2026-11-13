import { getUser } from '@/lib/server/auth'
import { redirect } from 'next/navigation'
import { tokenSchema } from '@/features/invitations/schemas'
import { AcceptForm } from '@/features/invitations/components/accept-form'
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!tokenSchema.safeParse(token).success)
    return (
      <>
        <h1>Invitación</h1>
        <p role="alert">Invitación inválida, caducada o para otro correo</p>
      </>
    )
  if (!(await getUser()))
    redirect('/login?next=' + encodeURIComponent('/invitations/' + token))
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Aceptar invitación</h1>
      <p>Únete a la organización con el correo al que te invitaron.</p>
      <AcceptForm token={token} />
    </div>
  )
}
