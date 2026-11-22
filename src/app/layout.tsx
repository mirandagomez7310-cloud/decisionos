import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import './globals.css'

export const metadata: Metadata = {
  title: 'DecisionOS',
  description: 'Información de negocio para distribuidoras.',
}
export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // El nonce del siguiente corte necesita que todas las rutas sean dinámicas.
  await headers()
  return (
    <html lang="es">
      <body>
        <a href="#main-content" className="skip-link sr-only focus:not-sr-only">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  )
}
