# F1-02 · Migración `0001_core` + tests pgTAP (fase 1, corte 2)

Brief para Codex. Especificación: `docs/DATABASE_SCHEMA.md` (convenciones, roles, funciones de autorización, tablas del núcleo de tenant, tests pgTAP). Este brief solo añade lo que ese documento deja abierto. Límites de entorno: los de `docs/tasks/F1-01-scaffold.md` (PowerShell, `npm.cmd`/`npx.cmd`, cachés en `TEMP`, nada de git que escriba).

## Entregables
1. `supabase/migrations/<timestamp>_core.sql` (nombre con `npx.cmd supabase migration new core`, sin arrancar Docker). Todo en una migración, en este orden: extensiones si hacen falta · `org_role` · `organizations` · `memberships` · `invitations` · `audit_log` · funciones `my_org_ids`, `my_org_ids_with_role`, `create_organization`, `accept_invitation` · trigger `set_updated_at` · triggers de `memberships` (auditoría y último owner) · RLS y políticas de las cuatro tablas · `grant`s mínimos (`anon` sin nada; `authenticated` solo lo que las políticas permiten; funciones `security definer` con `revoke execute from public` y `grant execute to authenticated`).
2. `supabase/tests/organizations_rls.test.sql`, `memberships_rls.test.sql`, `invitations_rls.test.sql`, `audit_log_rls.test.sql` (pgTAP, uno por tabla, los seis puntos de la sección "Tests pgTAP" del esquema que apliquen a cada tabla; el 5 y el 6 no aplican todavía). Usuarios de prueba creados en el propio test en `auth.users` y rol simulado con `set local role authenticated` + `set local request.jwt.claims` (patrón de la documentación de Supabase para pgTAP; léela en `node_modules/supabase` o en el `--help` del CLI si hace falta).
3. `supabase/seed.sql`: vacío o con un comentario; los datos de prueba de E2E se crean por API en el corte de auth.
4. `supabase/config.toml` (CLI 3.x): revisa que `[db]` apunte a la versión de Postgres de los proyectos nuevos de Supabase (mira `supabase init --help` y el `config.toml` generado), `[auth]` con `enable_signup = true`, confirmaciones de correo desactivadas en local (`enable_confirmations = false`) y `site_url`/`additional_redirect_urls` para `http://127.0.0.1:3000`. **No** actives ningún hook de JWT: los roles se leen de `memberships` (D-009).
5. Actualiza `docs/DATABASE_SCHEMA.md`: en el encabezado, estado «`0001_core` escrita (pendiente de CI)», y corrige cualquier detalle del documento que la migración haya tenido que resolver de otra forma (di cuál en el informe).

## Decisiones que el esquema deja abiertas (resueltas aquí)
- `create_organization(name text, slug text)` → `organizations` (devuelve el `id`); `security definer`, `set search_path = ''`, exige `auth.uid()` no nulo, inserta organización y membresía `owner` en la misma transacción y una fila en `audit_log` (`actor_kind = 'user'`, `action = 'organization.created'`).
- Invitaciones: el token en claro nunca se guarda. La app genera 32 bytes aleatorios, guarda `token_hash = encode(sha256(token), 'hex')` y envía el token por URL. `accept_invitation(token text)` (`security definer`): busca por hash, exige `expires_at > now()`, `accepted_at is null` y que el correo del usuario actual (`auth.jwt() ->> 'email'`) coincida con `invitations.email` sin distinguir mayúsculas; crea la membresía (si ya existe, actualiza el rol solo si el nuevo es mayor; una invitación nunca degrada), marca `accepted_at` y audita. Devuelve `organization_id`. Caducidad por defecto 7 días (`expires_at default now() + interval '7 days'`). `unique (organization_id, email) where accepted_at is null` como índice parcial: una invitación pendiente por correo y organización.
- `memberships`: política de escritura solo `owner/admin`; cualquier fila con `role = 'owner'` (insertar, cambiar a o desde, borrar) solo la toca un `owner` de esa organización, en la propia política (`using`/`with check`), no en trigger. Trigger `before delete or update` que impide dejar la organización sin `owner`. Un usuario no puede borrar ni degradar su propia membresía si es el último owner (lo cubre el mismo trigger). Trigger `after insert or update or delete` que escribe en `audit_log` (`actor_user_id = auth.uid()`, puede ser nulo en el camino de servicio) con `data` = fila antigua y nueva.
- `audit_log`: `insert` permitido a `authenticated` solo con `organization_id` del que es miembro (`with check`); sin políticas de `update`/`delete`; `select` solo `owner/admin`. Además `revoke update, delete on public.audit_log from authenticated, anon`.
- `organizations`: `select` miembros; `update` `owner/admin`; `delete` solo `owner`; **sin política de `insert`** (solo por `create_organization`). `slug`: `text` con `check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$')`, único global.
- `updated_at`: una sola función `public.set_updated_at()` y un trigger por tabla que tenga la columna.
- Índices: los del esquema más `invitations (organization_id, expires_at)` y `audit_log (organization_id, created_at desc)`.

## Reglas
- Cada política nombrada `<tabla>_<acción>` y con `to authenticated`; `organization_id in (select public.my_org_ids())` o `my_org_ids_with_role('{…}')`, nunca una función que reciba la columna.
- Funciones `security definer` siempre con `set search_path = ''` y nombres totalmente cualificados dentro.
- Sin Docker en local: no intentes `supabase start`, `db reset` ni `test db`. Comprueba la sintaxis leyéndola dos veces; el CI (corte 3) la ejecutará. Si existe forma de validar sintaxis SQL sin servidor en las dependencias instaladas, úsala y dilo.

## Informe final (en español, breve)
1. Archivos creados o modificados.
2. Desviaciones respecto al esquema o a este brief, con el porqué.
3. Qué pudiste verificar y qué queda para el CI.
4. `git status --short`.
