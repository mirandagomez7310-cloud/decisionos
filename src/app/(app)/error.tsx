'use client'
import { Button } from '@/components/ui/button'
import { LogoutButton } from '@/features/auth/components/logout-button'
// Sustituye a los layouts hijos: lleva su propia cabecera para no dejar al usuario sin salida.
export default function AppError({ reset }: { reset: () => void }) {
  return (
    <>
      <header className="app-header material">
        <span className="wordmark">DecisionOS</span>
        <div className="app-account">
          <LogoutButton />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="work-content">
        <div role="alert" className="dashboard-empty card">
          <h1 className="text-2xl font-semibold">
            No pudimos cargar esta página
          </h1>
          <p>Inténtalo de nuevo en unos momentos.</p>
          <Button onClick={reset}>Reintentar</Button>
        </div>
      </main>
    </>
  )
}
