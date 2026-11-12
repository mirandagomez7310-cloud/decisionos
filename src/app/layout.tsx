import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import { Providers } from './providers'
import { Geist } from 'next/font/google'
import { cn } from '@/lib/utils'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })

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
    <html lang="es" className={cn('font-sans', geist.variable)}>
      <body>
        <a href="#main-content" className="sr-only focus:not-sr-only">
          Saltar al contenido
        </a>
        <header className="border-b p-6">DecisionOS</header>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl p-6">
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  )
}
