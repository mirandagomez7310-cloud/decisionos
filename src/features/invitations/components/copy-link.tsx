'use client'
import { useState } from 'react'
export function CopyLink({ url }: { url: string }) {
  const [message, setMessage] = useState('')
  return (
    <>
      <button
        className="secondary-button compact"
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
      </button>
      <output>{message}</output>
    </>
  )
}
