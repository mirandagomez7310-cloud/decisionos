'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authenticate } from '../actions'
import { authSchema, type AuthInput } from '../schemas'
z.config({ jitless: true })
export function AuthForm({
  mode,
  next,
}: {
  mode: 'login' | 'signup'
  next: string
}) {
  const [message, setMessage] = useState('')
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AuthInput>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', password: '', next },
  })
  return (
    <form
      className="mx-auto flex max-w-sm flex-col gap-4"
      onSubmit={handleSubmit(async (values) => {
        setMessage('')
        try {
          const result = await authenticate(mode, values)
          if ('fieldErrors' in result && result.fieldErrors) {
            for (const field of ['email', 'password', 'next'] as const) {
              const error = result.fieldErrors[field]?.[0]
              if (error) setError(field, { message: error })
            }
          } else if ('error' in result) setMessage(result.error)
        } catch {
          setMessage('No pudimos conectar. Inténtalo de nuevo.')
        }
      })}
    >
      <h1 className="text-2xl font-semibold">
        {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
      </h1>
      <input type="hidden" {...register('next')} />
      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register('email')}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          {...register('password')}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {errors.password && (
          <p id="password-error" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>
      {message && <p role="alert">{message}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? 'Enviando…'
          : mode === 'login'
            ? 'Entrar'
            : 'Crear cuenta'}
      </Button>
      <Link
        className="underline"
        href={
          (mode === 'login' ? '/signup' : '/login') +
          '?next=' +
          encodeURIComponent(next)
        }
      >
        {mode === 'login' ? 'Crear una cuenta' : 'Ya tengo una cuenta'}
      </Link>
    </form>
  )
}
