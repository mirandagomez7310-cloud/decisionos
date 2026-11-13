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
