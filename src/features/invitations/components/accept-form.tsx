'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { acceptInvitation } from '../actions'
export function AcceptForm({ token }: { token: string }) {
  const [message, setMessage] = useState('')
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm()
  return (
    <form
      onSubmit={handleSubmit(async () => {
        try {
          const result = await acceptInvitation(token)
          setMessage(result.error)
        } catch {
          setMessage('No pudimos conectar. Inténtalo de nuevo.')
        }
      })}
    >
      <Button type="submit" disabled={isSubmitting}>
        Unirme
      </Button>
      {message && <p role="alert">{message}</p>}
    </form>
  )
}
