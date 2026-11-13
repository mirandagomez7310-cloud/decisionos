'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { authSchema } from './schemas'
export async function authenticate(mode: 'login' | 'signup', input: unknown) {
  const parsed = authSchema.safeParse(input)
  if (!parsed.success)
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    } as const
  if (mode !== 'login' && mode !== 'signup')
    return { ok: false, error: 'Solicitud inválida.' } as const
  try {
    const supabase = await createClient()
    const credentials = {
      email: parsed.data.email,
      password: parsed.data.password,
    }
    const { data, error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials)
    if (error)
      return {
        ok: false,
        error:
          mode === 'login'
            ? 'No pudimos iniciar sesión. Revisa tus credenciales.'
            : 'No pudimos crear la cuenta. Inténtalo de nuevo.',
      } as const
    if (!data.session)
      return {
        ok: false,
        error:
          'Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.',
      } as const
  } catch {
    return {
      ok: false,
      error: 'No pudimos conectar. Inténtalo de nuevo.',
    } as const
  }
  redirect(parsed.data.next)
}
export async function logout() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()
    if (error)
      return {
        ok: false,
        error: 'No pudimos cerrar la sesión. Inténtalo de nuevo.',
      } as const
  } catch {
    return {
      ok: false,
      error: 'No pudimos conectar. Inténtalo de nuevo.',
    } as const
  }
  redirect('/login')
}
