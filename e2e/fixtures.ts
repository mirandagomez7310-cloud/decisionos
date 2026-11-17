import { test as base, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'
// La lectura de variables se centraliza también para los procesos de herramientas.
import { toolingEnv } from '../tooling-env'
export const roles = [
  'owner',
  'admin',
  'analyst',
  'viewer',
  'outsider',
] as const
export const password = 'Decisionos-E2E-2026!'
export const slug = 'e2e-members'
export const email = (role: string) => `decisionos-e2e-${role}@example.com`
export function adminClient() {
  return createClient(toolingEnv.url, toolingEnv.secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
export function publicClient() {
  return createClient(toolingEnv.url, toolingEnv.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
export async function login(page: Page, userEmail: string, next = '/') {
  await page.goto('/login?next=' + encodeURIComponent(next))
  await page.getByLabel('Correo electrónico', { exact: true }).fill(userEmail)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

export const test = base.extend<{
  dashboardOwner: { orgSlug: string; userEmail: string }
}>({
  // oxlint-disable-next-line no-empty-pattern -- Playwright exige desestructurar el primer argumento del fixture.
  dashboardOwner: async ({}, use) => {
    const db = adminClient()
    // El check de slug admite 40 caracteres: 10 de prefijo + 12 hex.
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12)
    const orgSlug = `dashboard-${suffix}`
    const userEmail = `dashboard-${suffix}@example.com`
    const { data: user, error: userError } = await db.auth.admin.createUser({
      email: userEmail,
      password,
      email_confirm: true,
    })
    expect(userError).toBeNull()
    const { data: org, error: orgError } = await db
      .from('organizations')
      .insert({ name: 'Dashboard E2E', slug: orgSlug })
      .select('id')
      .single()
    expect(orgError).toBeNull()
    try {
      const { error } = await db.from('memberships').insert({
        organization_id: org!.id,
        user_id: user.user!.id,
        role: 'owner',
      })
      expect(error).toBeNull()
      await use({ orgSlug, userEmail })
    } finally {
      if (org) {
        const { error } = await db
          .from('organizations')
          .delete()
          .eq('id', org.id)
        expect(error).toBeNull()
      }
      if (user.user) {
        const { error } = await db.auth.admin.deleteUser(user.user.id)
        expect(error).toBeNull()
      }
    }
  },
})
