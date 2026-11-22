import { AuthForm } from '@/features/auth/components/auth-form'
import { sanitizeNext } from '@/features/auth/schemas'
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>
}) {
  const { next, error } = await searchParams
  return (
    <>
      {error === 'confirmation' && (
        <p className="auth-notice" role="alert">
          El enlace de confirmación caducó o ya se usó. Inicia sesión o vuelve a
          registrarte para recibir otro.
        </p>
      )}
      <AuthForm mode="login" next={sanitizeNext(next)} />
    </>
  )
}
