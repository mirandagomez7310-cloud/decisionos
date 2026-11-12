import { test, expect } from '@playwright/test'
import { adminClient, email, password, slug, login } from './fixtures'
const members = `/o/${slug}/settings/members`
test.describe('autenticación y organizaciones', () => {
  test('login válido e inválido', async ({ page }) => {
    await page.goto('/login')
    await page
      .getByLabel('Correo electrónico', { exact: true })
      .fill(email('owner'))
    await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta-123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(
      page.getByRole('alert').filter({ hasText: 'Revisa tus credenciales' }),
    ).toBeVisible()
    await login(page, email('owner'))
    await expect(page).toHaveURL('/')
  })
  test('registro conserva next hacia invitación', async ({ page }) => {
    const next = '/invitations/' + 'a'.repeat(64)
    await page.goto('/login?next=' + encodeURIComponent(next))
    await page
      .getByRole('link', { name: 'Crear una cuenta', exact: true })
      .click()
    await expect(page).toHaveURL('/signup?next=' + encodeURIComponent(next))
    await page
      .getByLabel('Correo electrónico', { exact: true })
      .fill(`signup-${crypto.randomUUID()}@example.com`)
    await page.getByLabel('Contraseña', { exact: true }).fill(password)
    await page
      .getByRole('button', { name: 'Crear cuenta', exact: true })
      .click()
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Revisa tu correo' })
        .or(page.getByRole('heading', { name: 'Aceptar invitación' })),
    ).toBeVisible()
  })
  test('crea organización y rechaza slug repetido', async ({ page }) => {
    await login(page, email('owner'), '/organizations/new')
    const unique = 'org-' + crypto.randomUUID().slice(0, 12)
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.goto('/organizations/new')
      await page
        .getByLabel('Nombre', { exact: true })
        .fill('Nueva organización')
      await page
        .getByLabel('Identificador de la organización', { exact: true })
        .fill(unique)
      await page
        .getByRole('button', { name: 'Crear organización', exact: true })
        .click()
      if (!attempt) await expect(page).toHaveURL('/o/' + unique)
      else
        await expect(
          page.getByRole('alert').filter({ hasText: 'ya está en uso' }),
        ).toBeVisible()
    }
  })
})
test.describe('miembros e invitaciones', () => {
  test.use({ storageState: 'e2e/.auth/owner.json' })
  test('owner invita, copia enlace, usuario nuevo acepta y aparece', async ({
    page,
    browser,
  }) => {
    const invitee = `invite-${crypto.randomUUID()}@example.com`
    const admin = adminClient()
    const { error } = await admin.auth.admin.createUser({
      email: invitee,
      password,
      email_confirm: true,
    })
    if (error) throw error
    await page.goto(members)
    await page.getByLabel('Correo de invitación', { exact: true }).fill(invitee)
    await page.getByRole('button', { name: 'Invitar', exact: true }).click()
    const url = await page
      .locator('output[aria-label="Enlace de invitación"]')
      .textContent()
    expect(url).toMatch(/^\/invitations\/[0-9a-f]{64}$/)
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            ;(window as unknown as { copied: string }).copied = text
          },
        },
      })
    })
    await page
      .getByRole('button', { name: 'Copiar enlace', exact: true })
      .first()
      .click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Enlace copiado.' }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => (window as unknown as { copied: string }).copied,
      ),
    ).toContain(url!)
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const fresh = await context.newPage()
    await fresh.goto(url!)
    await expect(fresh).toHaveURL('/login?next=' + encodeURIComponent(url!))
    await login(fresh, invitee, url!)
    await fresh.getByRole('button', { name: 'Unirme', exact: true }).click()
    await expect(fresh).toHaveURL('/o/' + slug)
    await context.close()
    await page.reload()
    await page.getByRole('link', { name: 'Correo', exact: true }).click()
    await expect(
      page.getByRole('cell', { name: invitee, exact: true }),
    ).toBeVisible()
  })
  test('cambia rol y protege al último owner', async ({ page }) => {
    const admin = adminClient()
    const { data: org } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single()
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const analyst = users.users.find((user) => user.email === email('analyst'))!
    await admin
      .from('memberships')
      .update({ role: 'analyst' })
      .eq('organization_id', org!.id)
      .eq('user_id', analyst.id)
    await page.goto(members)
    const row = page
      .getByRole('row')
      .filter({
        has: page.getByRole('cell', { name: email('analyst'), exact: true }),
      })
    await row.getByRole('combobox').click()
    await page.getByRole('option', { name: 'viewer', exact: true }).click()
    await row.getByRole('button', { name: 'Guardar rol', exact: true }).click()
    await expect(
      row.getByRole('alert').filter({ hasText: 'Cambio guardado' }),
    ).toBeVisible()
    const ownerRow = page
      .getByRole('row')
      .filter({
        has: page.getByRole('cell', { name: email('owner'), exact: true }),
      })
    await ownerRow.getByRole('combobox').click()
    await page.getByRole('option', { name: 'admin', exact: true }).click()
    await ownerRow
      .getByRole('button', { name: 'Guardar rol', exact: true })
      .click()
    await expect(
      ownerRow
        .getByRole('alert')
        .filter({ hasText: 'al menos un propietario' }),
    ).toBeVisible()
  })
  test('vistas principales no violan CSP', async ({ page }) => {
    await page.addInitScript(() => {
      const state = window as unknown as { violations: string[] }
      state.violations = []
      window.addEventListener('securitypolicyviolation', (event) =>
        state.violations.push(event.violatedDirective),
      )
    })
    for (const url of [
      '/',
      '/o/' + slug,
      members,
      `/o/${slug}/settings/audit`,
      '/organizations/new',
      '/invitations/' + 'a'.repeat(64),
    ]) {
      await page.goto(url)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(
        await page.evaluate(
          () => (window as unknown as { violations: string[] }).violations,
        ),
      ).toEqual([])
    }
  })
})
test('admin no ve owner y la acción rechaza una solicitud manipulada', async ({
  page,
}) => {
  await login(page, email('admin'), members)
  await page.getByLabel('Rol de invitación', { exact: true }).click()
  await expect(
    page.getByRole('option', { name: 'owner', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('option', { name: 'viewer', exact: true }).click()
  await page.route('**/settings/members', async (route) => {
    const request = route.request()
    if (request.method() === 'POST' && request.headers()['next-action']) {
      const body = request.postData() ?? ''
      expect(body).toContain('viewer')
      await route.continue({ postData: body.replace('viewer', 'owner') })
    } else await route.continue()
  })
  await page
    .getByLabel('Correo de invitación', { exact: true })
    .fill(`blocked-${crypto.randomUUID()}@example.com`)
  await page.getByRole('button', { name: 'Invitar', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'No tienes permiso' }),
  ).toBeVisible()
})
for (const role of ['viewer', 'outsider'])
  test(`${role} no accede a miembros`, async ({ page }) => {
    await login(page, email(role), members)
    await expect(page).toHaveURL('/no-access')
  })
test('revocación de membresía surte efecto en la siguiente navegación', async ({
  page,
}) => {
  const admin = adminClient()
  const freshEmail = `revoke-${crypto.randomUUID()}@example.com`
  const { data: user, error } = await admin.auth.admin.createUser({
    email: freshEmail,
    password,
    email_confirm: true,
  })
  if (error) throw error
  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()
  const { error: insertError } = await admin
    .from('memberships')
    .insert({ organization_id: org!.id, user_id: user.user.id, role: 'viewer' })
  if (insertError) throw insertError
  await login(page, freshEmail, '/o/' + slug)
  const { error: deleteError } = await admin
    .from('memberships')
    .delete()
    .eq('organization_id', org!.id)
    .eq('user_id', user.user.id)
  if (deleteError) throw deleteError
  await page.goto('/o/' + slug)
  await expect(page).toHaveURL('/no-access')
})
