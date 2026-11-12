'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
export function CopyLink({ url }: { url: string }) {
  const [message, setMessage] = useState('')
  return (
    <>
      <Button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              new URL(url, window.location.origin).href,
            )
            setMessage('Enlace copiado.')
          } catch {
            setMessage(
              'No se pudo copiar. Selecciona el enlace y cópialo manualmente.',
            )
          }
        }}
      >
        Copiar enlace
      </Button>
      <output>{message}</output>
    </>
  )
}
