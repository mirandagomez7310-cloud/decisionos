'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { authenticate } from '../actions'
import { authSchema, type AuthInput } from '../schemas'
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
      className="auth-form"
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
      <h1>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
      <input type="hidden" {...register('next')} />
      <div className="field-group">
        <div className="field-row">
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            {...register('email')}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
        </div>
        <div className="field-row">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            {...register('password')}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
          />
        </div>
      </div>
      {errors.email && (
        <p id="email-error" className="field-error" role="alert">
          {errors.email.message}
        </p>
      )}
      {errors.password && (
        <p id="password-error" className="field-error" role="alert">
          {errors.password.message}
        </p>
      )}
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
      <button className="pill-button" type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? 'Enviando…'
          : mode === 'login'
            ? 'Entrar'
            : 'Crear cuenta'}
      </button>
      <Link
        className="underline auth-switch"
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
