import { test as setup } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import {
  adminClient,
  publicClient,
  roles,
  email,
  password,
  slug,
  login,
} from './fixtures'
setup('prepara usuarios, organización y sesiones por rol', async ({ page }) => {
  const admin = adminClient()
  const { data: oldOrgs, error: orgError } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
  if (orgError) throw orgError
  for (const org of oldOrgs ?? []) {
    const { error } = await admin
      .from('organizations')
      .delete()
      .eq('id', org.id)
    if (error) throw error
  }
  const ids: Record<string, string> = {}
  for (const role of roles) {
    const { data, error } = await admin.auth.admin.createUser({
      email: email(role),
      password,
      email_confirm: true,
    })
    if (error) {
      const { data: users, error: listError } =
        await admin.auth.admin.listUsers({ perPage: 1000 })
      const user = users?.users.find((user) => user.email === email(role))
      if (listError || !user) throw error
      const { error: updateError } = await admin.auth.admin.updateUserById(
        user.id,
        { password, email_confirm: true },
      )
      if (updateError) throw updateError
      ids[role] = user.id
    } else ids[role] = data.user.id
  }
  const owner = publicClient()
  const { error: loginError } = await owner.auth.signInWithPassword({
    email: email('owner'),
    password,
  })
  if (loginError) throw loginError
  const { data: org, error } = await owner.rpc('create_organization', {
    name: 'Organización E2E',
    slug,
  })
  if (error || !org) throw error ?? new Error('No se creó la organización')
  for (const role of ['admin', 'analyst', 'viewer']) {
    const { error } = await admin
      .from('memberships')
      .insert({ organization_id: org.id, user_id: ids[role], role })
    if (error) throw error
  }
  await mkdir('e2e/.auth', { recursive: true })
  for (const role of roles) {
    await page.context().clearCookies()
    await login(page, email(role))
    await page.context().storageState({ path: `e2e/.auth/${role}.json` })
  }
})
