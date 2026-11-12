'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createOrganization } from '../actions'
import {
  organizationSchema,
  suggestSlug,
  type OrganizationInput,
} from '../schemas'
export function OrganizationForm() {
  const [message, setMessage] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationInput>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { name: '', slug: '' },
  })
  return (
    <form
      className="mx-auto flex max-w-md flex-col gap-4"
      onSubmit={handleSubmit(async (values) => {
        setMessage('')
        try {
          const result = await createOrganization(values)
          if ('fieldErrors' in result && result.fieldErrors) {
            for (const field of ['name', 'slug'] as const) {
              const error = result.fieldErrors[field]?.[0]
              if (error) setError(field, { message: error })
            }
          } else if ('error' in result) setMessage(result.error)
        } catch {
          setMessage('No pudimos conectar. Inténtalo de nuevo.')
        }
      })}
    >
      <h1 className="text-2xl font-semibold">Crear organización</h1>
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          autoComplete="organization"
          {...register('name', {
            onChange: (event) => {
              if (!slugEdited) setValue('slug', suggestSlug(event.target.value))
            },
          })}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && (
          <p id="name-error" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Identificador de la organización</Label>
        <Input
          id="slug"
          autoComplete="off"
          {...register('slug', { onChange: () => setSlugEdited(true) })}
          aria-invalid={!!errors.slug}
          aria-describedby={'slug-help' + (errors.slug ? ' slug-error' : '')}
        />
        <p id="slug-help">Se usará en la dirección de tu organización.</p>
        {errors.slug && (
          <p id="slug-error" role="alert">
            {errors.slug.message}
          </p>
        )}
      </div>
      {message && (
        <p role="alert">
          {message === 'unauthenticated' ? (
            <>
              Tu sesión caducó.{' '}
              <Link
                className="underline"
                href="/login?next=%2Forganizations%2Fnew"
              >
                Inicia sesión
              </Link>{' '}
              para continuar. Tus datos siguen en este formulario.
            </>
          ) : (
            message
          )}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creando…' : 'Crear organización'}
      </Button>
    </form>
  )
}
