# F5-04 · Alertas por correo (fase 5b, corte 1)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee antes: D-031 y D-032 en `docs/DECISIONS.md`, `supabase/migrations/20261119000000_insights.sql`, `20261112020000_core.sql` (`memberships`, `audit_log`), `src/env.ts`, `src/lib/server/jobs/` completo, `src/lib/server/insights/describe.ts`, `src/lib/format.ts`, `scripts/verify.ps1`, `.github/workflows/ci.yml` y `e2e/insights.spec.ts`.

Objetivo: cuando el cálculo crea insights nuevos `warning` o `critical`, owner y admin de la organización reciben **un correo** con todos ellos y un enlace a Diagnóstico. Sin reenvíos: el mismo insight nunca llega dos veces a la misma persona.

## 1. SQL: `supabase/migrations/20261120000000_deliveries.sql`
- Tabla `deliveries`: `id`, `organization_id` (FK con `on delete cascade`), `kind` (`alert`, `weekly_report`), `dedupe_key text not null`, `insight_id uuid null` (FK compuesta a `insights(organization_id, id)`, con `on delete cascade`; añade `unique (organization_id, id)` a `insights` si hace falta), `recipient_user_id uuid not null` (FK a `auth.users` con `on delete cascade`), `recipient_email text not null`, `status` (`pending`, `sent`, `failed`, por defecto `pending`), `attempts int not null default 0`, `last_error text`, `sent_at timestamptz`, `created_at`, `updated_at` (trigger `set_updated_at`). `unique (organization_id, dedupe_key)`.
- RLS activada **sin políticas ni grants** para `anon` y `authenticated` (solo `service_role`). Nadie la consulta desde la UI en este corte.
- `alert_recipients(p_organization_id uuid)` → `setof (user_id uuid, email text)`: miembros `owner` y `admin` con email de `auth.users`. `security definer`, `search_path = ''`, `execute` solo para `service_role`.
- `pending_alerts(p_organization_id uuid)` → `setof (insight_id, recipient_user_id, recipient_email)`: pares de insight × destinatario donde el insight es de la organización, `severity in ('warning', 'critical')`, `status = 'new'`, `created_at >= now() - interval '7 days'` y no existe `delivery` con `dedupe_key = 'alert:' || insight_id || ':' || user_id` en estado `sent`, ni en `failed` con `attempts >= 3`. `security definer`, solo `service_role`.
- `jobs.kind`: añade `send_alerts` y `weekly_report` (el segundo lo usa F5-05; añádelo ya). Índice único parcial para `send_alerts` igual que `compute_insights`, y `enqueue_alerts(p_organization_id)` con el patrón de `enqueue_insights`.
- pgTAP `supabase/tests/deliveries.test.sql`: `alert_recipients` devuelve solo owner y admin de la organización; `pending_alerts` excluye `info`, los que no son `new`, los de más de 7 días, los ya `sent` y los `failed` con 3 intentos, e incluye un `failed` con 1 intento; `unique` de `dedupe_key`; `authenticated` y `anon` no leen `deliveries` ni ejecutan las funciones (`42501`); denegación cruzada entre organizaciones.

## 2. Correo: `src/lib/server/mail/`
- `env.ts` (en `src/env.ts`, en `serverEnvSchema`): `MAIL_DRIVER` (`z.enum(['mailpit']).optional()`), `MAIL_FROM` (por defecto `DecisionOS <alertas@decisionos.local>`), `APP_URL` (`z.url()`, por defecto `http://127.0.0.1:3000`), `MAILPIT_URL` (`z.url()`, por defecto `http://127.0.0.1:54324`).
- `index.ts`: `sendMail({ to, subject, text, html })` → `{ ok: true } | { ok: false, error }`. Sin `MAIL_DRIVER`: `{ ok: false, error: 'mail-disabled' }` sin hacer nada. Driver `mailpit`: `POST {MAILPIT_URL}/api/v1/send` con `From`, `To`, `Subject`, `Text` y `HTML` (consulta la API de Mailpit v1.31 si dudas del formato). Errores de red o HTTP como dato, nunca lanzados.
- Validación en el borde: `subject` sin `\r` ni `\n` (sustitúyelos por espacio) y `to` validado como email con Zod.
- `templates.ts` (puro): `alertEmail({ organizationName, appUrl, slug, insights })` → `{ subject, text, html }`.
  - Asunto: «DecisionOS · {n} alertas nuevas en {organización}» (singular si es 1).
  - Cuerpo: cada insight con su gravedad («Crítico», «Atención»), `title` y `body`; al final, el enlace absoluto `{appUrl}/o/{slug}/insights`.
  - HTML mínimo y accesible (sin imágenes ni CSS externo), con **todo** valor interpolado escapado (`&`, `<`, `>`, `"`, `'`). Test con un título que contenga `<script>` y un nombre de organización con `\n`.

## 3. Job `send_alerts` (`src/lib/server/jobs/handlers/alerts.ts`)
1. `pending_alerts(organization_id)`; si no hay, audita y termina.
2. Agrupa por destinatario. Por cada uno: inserta (o reutiliza el `failed`) una fila `pending` por insight con su `dedupe_key`, usando `upsert` con `onConflict: 'organization_id,dedupe_key'`; envía **un** correo con todos sus insights; actualiza esas filas a `sent` (con `sent_at`) o a `failed` (con `attempts + 1` y `last_error`).
3. Un fallo de envío a un destinatario no detiene a los demás ni lanza (el job termina `done`; los `failed` se reintentan en la siguiente pasada). `mail-disabled` no cuenta como intento: deja las filas en `pending` y lo registra en la auditoría.
4. Audita `alerts.sent` con `{ recipients, insights, failed }`.
- `runPendingJobs`: añade `send_alerts`.
- `handleComputeInsights`: al terminar, `enqueue_alerts(organization_id)` de forma no fatal, como `enqueueInsights` en `shared.ts`.
- Nombre y slug de la organización: léelos de `organizations` con el cliente de servicio y el `organization_id` del job.

## 4. Entorno de pruebas
- `scripts/verify.ps1` y `.github/workflows/ci.yml`: `MAIL_DRIVER=mailpit` y `APP_URL=http://127.0.0.1:3000` (Mailpit lo levanta `supabase start` en `54324`).
- `.env.example` (si existe) con las cuatro variables y un comentario.

## Tests
- Vitest: `sendMail` (sin driver, Mailpit OK, Mailpit 500, red caída, asunto con salto de línea), `alertEmail` (singular y plural, escape HTML, enlace absoluto) y el handler con un doble del cliente (agrupa por destinatario, un fallo no detiene a otro, `mail-disabled` deja `pending`, audita).
- **E2E `e2e/alerts.spec.ts`**: el owner importa clientes y cuentas por cobrar con saldo a más de 90 días (como `e2e/insights.spec.ts`); con `expect.poll` sobre `GET {MAILPIT_URL}/api/v1/search?query=to:"{email}"` comprueba que llega **un** correo con asunto «DecisionOS · …alerta…», que contiene «clientes con riesgo alto» y el enlace a `/insights`. Vuelve a disparar el cálculo (otra importación pequeña) y comprueba que no llega un segundo correo con el mismo insight. Borra sus mensajes de Mailpit al terminar (`DELETE /api/v1/messages` con sus ids).

## Reglas
- Sin librerías nuevas. Nada de aritmética de dinero en TS: el texto sale de `title` y `body`.
- Nunca registres el contenido del correo ni direcciones en `console`; en la auditoría, solo los conteos.
- Acentos: antes de terminar, `git diff | grep -nP "[A-Za-z]\?[a-z]"` sin coincidencias.
- `typecheck`, `lint`, `test`, `build` y `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`. pgTAP, E2E y la prueba con Mailpit los corre Claude Code.
