import { z } from '@/lib/zod'
export const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Introduce el nombre.')
    .max(120, 'Usa como máximo 120 caracteres.'),
  slug: z
    .string()
    .regex(
      /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/,
      'Usa 1 o entre 3 y 40 letras minúsculas, números y guiones, sin guiones en los extremos.',
    ),
})
export type OrganizationInput = z.infer<typeof organizationSchema>
export function suggestSlug(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-|-$/g, '')
}
