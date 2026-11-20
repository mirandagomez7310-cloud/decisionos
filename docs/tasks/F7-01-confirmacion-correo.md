# F7-01 · Confirmación de cuenta por correo (fase 7a, corte 1)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee antes: `src/features/auth/` completo (`actions.ts`, `schemas.ts` con `sanitizeNext`, y sus tests), `src/app/(auth)/login/page.tsx` y `signup`, `src/lib/supabase/server.ts`, `src/env.ts`, `supabase/config.toml` (secciones `[auth]` y `[auth.email]`), `e2e/members.spec.ts` y `e2e/fixtures.ts`. Next.js 16: lee `node_modules/next/dist/docs/` para Route Handlers antes de escribir la ruta.

Contexto verificado en la documentación de Supabase (2026-11-19): con SSR la plantilla de confirmación enlaza a `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}` y una ruta GET llama a `supabase.auth.verifyOtp({ type, token_hash })`. `{{ .RedirectTo }}` es el `emailRedirectTo` del `signUp`, una **URL absoluta**.

## 1. Configuración (`supabase/config.toml`)
- `[auth.email] enable_confirmations = true`.
- `additional_redirect_urls`: añade `"http://127.0.0.1:3000/**"` y mantén las existentes.
- Plantilla:
  ```toml
  [auth.email.template.confirmation]
  subject = "Confirma tu cuenta de DecisionOS"
  content_path = "./supabase/templates/confirmation.html"
  ```
- `supabase/templates/confirmation.html`: HTML mínimo en español con un párrafo, el enlace de arriba («Confirmar mi cuenta») y la nota «Si no creaste una cuenta, ignora este correo». Sin imágenes ni estilos externos.

## 2. Registro (`src/features/auth/actions.ts`)
- En `signUp`, pasa `options: { emailRedirectTo: new URL(parsed.data.next, env.APP_URL).toString() }`. `next` ya pasa por `sanitizeNext`.
- No cambies los mensajes existentes. Con un correo ya registrado, Supabase responde sin sesión y sin error: el usuario ve «Revisa tu correo…» igual que uno nuevo. Así debe seguir, para no revelar qué correos existen.

## 3. Ruta `src/app/auth/confirm/route.ts` (GET)
- Valida con `z` (desde `@/lib/zod`): `token_hash` (string de 1 a 512) y `type` (`z.literal('email')`).
- `next`: si empieza por `/`, pásalo por `sanitizeNext`. Si es una URL absoluta, acéptala solo si `new URL(next).origin === new URL(env.APP_URL).origin`, y pasa `pathname + search` por `sanitizeNext`. En cualquier otro caso usa `/`. Extrae esta lógica a una función pura `confirmRedirect(next, appUrl)` en `src/features/auth/schemas.ts`, con tests.
- Llama a `verifyOtp` con `createClient()` de `@/lib/supabase/server`. Si sale bien, `redirect` a `next`. Si la validación falla, si `verifyOtp` devuelve error o si lanza, `redirect('/login?error=confirmation')`. Nunca muestres el error de Supabase.
- `/login`: si `searchParams.error === 'confirmation'`, muestra un `role="alert"` con el texto «El enlace de confirmación caducó o ya se usó. Inicia sesión o vuelve a registrarte para recibir otro.». Cualquier otro valor se ignora.

## 4. Tests
- Vitest:
  - `confirmRedirect`: ruta relativa válida; `//evil.com`; `https://evil.com/x`; misma origin con query; `javascript:`; vacío.
  - La ruta, con el cliente simulado: éxito → `next`; `type` distinto de `email` → error; `verifyOtp` con error → `/login?error=confirmation`.
  - `signUp` recibe `emailRedirectTo` absoluto.
- E2E `members.spec.ts`, «registro conserva next hacia invitación»:
  1. Después de «Crear cuenta», espera el aviso «Revisa tu correo» (quita la alternativa `.or(...)`).
  2. Busca el mensaje en la API de Mailpit: `GET ${MAILPIT_URL}/api/v1/search?query=to:"<correo>"`. Reintenta con `expect.poll` hasta 10 s. Lee el mensaje con `GET /api/v1/message/{ID}`, extrae el `href` que contiene `/auth/confirm` del HTML y decodifica `&amp;`.
  3. Ábrelo y espera `toHaveURL(next)`, o el encabezado «Aceptar invitación».
- E2E nuevo, en el mismo `describe`: `/auth/confirm?token_hash=x&type=email` lleva a `/login?error=confirmation` y muestra el aviso.
- `MAILPIT_URL` en E2E: usa `process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'`.

## Reglas
- No toques `supabase/seed.sql`. Los demás E2E ya crean usuarios con `email_confirm: true`: compruébalo con un `grep` y no los cambies.
- Acentos: antes de terminar, `git diff | grep -nP "[A-Za-z]\?[a-z]"` sin coincidencias.
- `typecheck`, `lint`, `test`, `build` y `node node_modules/@playwright/test/cli.js test --list` en verde. Pon `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`.
