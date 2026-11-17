import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import { Barlow, Barlow_Condensed } from 'next/font/google'
import { cn } from '@/lib/utils'

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
})
const condensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-barlow-condensed',
})

export const metadata: Metadata = {
  title: 'DecisionOS',
  description: 'Información de negocio para distribuidoras.',
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // El nonce del siguiente corte necesita que todas las rutas sean dinámicas.
  await headers()
  return (
    <html
      lang="es"
      className={cn('font-sans', barlow.variable, condensed.variable)}
    >
      <body>
        <a href="#main-content" className="skip-link sr-only focus:not-sr-only">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  )
}
