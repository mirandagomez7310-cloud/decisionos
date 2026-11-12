'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { logout } from '../actions'
export function LogoutButton() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  return (
    <div>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError('')
            try {
              const result = await logout()
              if (result) setError(result.error)
            } catch {
              setError('No pudimos conectar. Inténtalo de nuevo.')
            }
          })
        }
      >
        Cerrar sesión
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
