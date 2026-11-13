'use client'
import { Button } from '@/components/ui/button'
export default function AppError({ reset }: { reset: () => void }) {
  return (
    <div role="alert">
      <h1 className="text-2xl font-semibold">No pudimos cargar esta página</h1>
      <p className="my-4">Inténtalo de nuevo en unos momentos.</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  )
}
