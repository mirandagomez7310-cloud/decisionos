import { AuthForm } from '@/features/auth/components/auth-form'
import { sanitizeNext } from '@/features/auth/schemas'
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  return (
    <AuthForm mode="login" next={sanitizeNext((await searchParams).next)} />
  )
}
