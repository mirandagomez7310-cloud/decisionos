import type { NextRequest } from 'next/server'
import { env, isDevelopment } from '@/env'
import { createCsp } from '@/lib/csp'
import { updateSession } from '@/lib/supabase/proxy'
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = createCsp(nonce, env.NEXT_PUBLIC_SUPABASE_URL, isDevelopment)
  request.headers.set('x-nonce', nonce)
  request.headers.set('Content-Security-Policy', csp)
  request.headers.set(
    'x-pathname',
    request.nextUrl.pathname + request.nextUrl.search,
  )
  const response = await updateSession(request)
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
