# F1-04 · Supabase, sesión, CSP y organizaciones (fase 1, corte 4)

Brief para Codex. Límites de entorno: `docs/tasks/F1-01-scaffold.md`. Contexto: `docs/ARCHITECTURE.md` (§3 capas, §5 multi-tenant, §6 seguridad, §8 carpetas) y la migración `supabase/migrations/*_core.sql`. Antes de escribir, lee en `node_modules/next/dist/docs/` lo de proxy, CSP/nonce y Server Actions, y en `node_modules/@supabase/ssr/` el README (versión instalada, no la de memoria).

## Entregables
1. **Clientes Supabase** en `src/lib/supabase/`: `server.ts` (`createServerClient` con cookies de `next/headers`), `client.ts` (`createBrowserClient`), `proxy.ts` (`updateSession(request)`: crea el cliente y llama a `getClaims()` inmediatamente después, sin código entre medias; si redirige, copia las cookies de `supabaseResponse`), `admin.ts` (`import 'server-only'`, clave `SUPABASE_SECRET_KEY`, solo para jobs y E2E; nunca en acciones de usuario). Tipos: `types.ts` lo generará `db:types` en CI; mientras, un `types.ts` mínimo escrito a mano con `organizations`, `memberships`, `invitations`, `audit_log` y `org_role`, marcado con un comentario «generado a mano hasta el primer `db:types`».
2. **`src/proxy.ts`** (Next 16): `updateSession` + CSP con nonce por petición: `default-src 'self'`; `script-src 'self' 'nonce-…' 'strict-dynamic'` (+ `'unsafe-eval'` solo en desarrollo); `style-src 'self' 'nonce-…' '<hash sha256 del <style> que inyecta Sonner>' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='` (cadena vacía); `style-src-attr 'unsafe-inline'`; `connect-src 'self' <NEXT_PUBLIC_SUPABASE_URL> wss://<host de Supabase>`; `img-src 'self' blob: data:`; `font-src 'self'`; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `upgrade-insecure-requests` solo si la URL de Supabase es `https`. Matcher que excluye `_next/static`, `_next/image`, `favicon.ico` y prefetch. Un test Vitest `src/lib/csp.test.ts` que recalcula el hash del estilo de Sonner leyendo `node_modules/sonner` y lo compara con la constante (si Sonner cambia, falla en CI y no en producción). `z.config({ jitless: true })` en `src/app/providers.tsx` (cliente) para que Zod no use `new Function`.
3. **`src/lib/server/auth.ts`** (`server-only`): `getUser()` (null si no hay sesión); `getMembership(orgSlug)` → `{ organization, role } | null`; `requireRole(orgSlug, ...roles)` para páginas (redirige a `/login?next=` sin sesión, a `/no-access` sin membresía o rol insuficiente) y `requireRoleForAction(orgId, ...roles)` para Server Actions (devuelve `{ ok: false, error: 'unauthenticated' | 'forbidden' }` en vez de redirigir). Siempre leen `memberships`, nunca el JWT (D-009).
4. **Rutas** (copy en español, código en inglés):
   - `src/app/(auth)/login/page.tsx` y `(auth)/signup/page.tsx`: correo + contraseña, `features/auth/{schemas,actions}.ts` (Zod compartido entre `zodResolver` y `safeParse`; errores `{ ok: false, fieldErrors }`; con `next` saneado: solo rutas relativas internas). Campos con `Label` + `Input` + `register`, `aria-invalid` y `aria-describedby`; botón deshabilitado mientras `isSubmitting`. Registro con `enable_signup` (sin confirmación de correo en local, según `config.toml`).
   - `src/app/(app)/layout.tsx`: exige sesión; cabecera con el correo y «Cerrar sesión» (Server Action).
   - `src/app/(app)/page.tsx` (`/`): con sesión, redirige a `/o/<slug>` de la primera organización o a `/organizations/new`; sin sesión, a `/login`.
   - `src/app/(app)/organizations/new/page.tsx`: nombre + slug (sugerido desde el nombre, editable, validado con el mismo regex que la migración); `features/organizations/{schemas,actions,queries}.ts`; la acción llama a `rpc('create_organization')` y redirige a `/o/<slug>`. Error de slug repetido como `fieldErrors.slug`.
   - `src/app/(app)/o/[slug]/layout.tsx`: `requireRole(slug, 'owner','admin','analyst','viewer')`; navegación mínima (Inicio · Miembros, este último solo para owner/admin; la página de miembros llega en F1-05). `src/app/(app)/o/[slug]/page.tsx`: placeholder «Panel de <organización>» con el rol del usuario.
   - `src/app/(app)/no-access/page.tsx`: explica que no hay membresía y cómo conseguirla (invitación); no es un error.
   - `error.tsx` en la raíz de `(app)` y `global-error.tsx`: mensaje accesible (`role="alert"`), sin stack trace.
5. **Tests Vitest**: esquemas de `auth` y `organizations` (válido/inválido, saneado de `next`, slug), `csp.test.ts`. Los Server Components se prueban en E2E (F1-05).
6. **`.env.example`**: sin cambios de claves; añade un comentario de dónde salen (panel de Supabase → API).

## Reglas
- Las páginas no consultan Supabase directamente: pasan por `features/<módulo>/queries.ts`.
- Server Action = Zod → `requireRoleForAction` → operar → `{ ok, data | fieldErrors | error }`; nunca lanzar al cliente. Sesión caducada a mitad de un formulario: la acción devuelve `error: 'unauthenticated'` y el formulario conserva lo escrito y muestra un enlace a `/login`.
- Nada de `useEffect` para datos; Server Components + Server Actions. Sin TanStack Query.
- Sin Supabase local ni remoto disponible en el sandbox: no podrás arrancar la app contra una base real. Verifica con `typecheck`, `lint`, `test`, `build`, y una prueba de humo de CSP sin BD: `npm.cmd run build`, `npm.cmd run start` en segundo plano, `curl.exe -sI http://127.0.0.1:3000/login` y comprueba la cabecera `Content-Security-Policy`; para parar el servidor, mata el proceso que escucha en el puerto 3000 (no se llama «next start»). Si `start` necesita variables, usa los valores de `.env.example` en `.env.local` (no la versiones).

## Fuera de este corte
Miembros, invitaciones, `audit_log` en UI, E2E, Lighthouse, Vercel (F1-05 y F1-06).

## Informe final (en español, breve)
Archivos creados o modificados · desviaciones y porqué · salida de typecheck/lint/test/build y la cabecera CSP obtenida · `git status --short`.
