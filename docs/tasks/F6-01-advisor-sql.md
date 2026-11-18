# F6-01 · Advisor: ejecuciones, caché y límite en SQL (fase 6, corte 1)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee antes: D-002, D-031 y D-033 en `docs/DECISIONS.md`, `supabase/migrations/20261119000000_insights.sql` (tabla `insights`, `check` de `fact`, `enqueue_insights`), `20261120000000_deliveries.sql` (último `check` de `jobs.kind`, patrón de índice único parcial y `enqueue_alerts`), `20261121000000_weekly_reports.sql` (`for key share`), `20261112020000_core.sql` (`my_org_ids`, `my_org_ids_with_role`) y `supabase/tests/insights.test.sql` como modelo.

## Migración `supabase/migrations/20261122000000_advisor.sql`

### Tabla `advisor_runs`
`id` · `organization_id` (FK con `on delete cascade`) · `period_start date not null` · `input_hash text not null` · `status` (`queued`, `running`, `done`, `failed`; por defecto `queued`) · `cached boolean not null default false` · `driver text` · `model text` · `input_tokens int` · `output_tokens int` · `items int` · `error text` · `requested_by uuid` (nullable, FK a `auth.users` con `on delete set null`) · `created_at` · `finished_at`. `unique (organization_id, id)`. Índice `(organization_id, created_at desc)`.
- RLS: select para `authenticated` con `organization_id in (select public.my_org_ids())`. Sin insert, update ni delete para `authenticated` ni `anon`.

### `jobs`
Amplía el `check` de `jobs.kind` con `advisor` e índice único parcial `jobs_active_advisor_idx` (un `advisor` en `queued` o `running` por organización), como `send_alerts`.

### `request_advisor(p_organization_id uuid, p_input_hash text, p_daily_limit int) returns jsonb`
`plpgsql security definer set search_path = ''`, `execute` solo para `authenticated`. La llama la Server Action con el cliente del usuario, así que el usuario es `auth.uid()`.
1. Exige que el usuario sea owner, admin o analyst de la organización (`my_org_ids_with_role`); si no, `42501`. Valida `p_input_hash` (64 hex) y `p_daily_limit` (1–100); si no, `22023`.
2. Periodo: día 1 del mes en curso en `America/Mexico_City`.
3. Si ya hay una ejecución `queued` o `running` de la organización: devuelve `{ "status": "running", "run_id": … }` sin crear nada.
4. **Caché:** si hay una `done` con el mismo `input_hash` y periodo, inserta una ejecución nueva `done` con `cached = true` que copia `driver`, `model` e `items` de la cacheada (no encola nada) y devuelve `{ "status": "cached", "run_id": … }`.
5. **Límite:** cuenta las ejecuciones `cached = false` de la organización creadas hoy (día de México) salvo las `failed` con `error in ('disabled', 'busy')`, que no llegaron a llamar al modelo. Si son `>= p_daily_limit`, devuelve `{ "status": "limit", "used": n, "limit": p_daily_limit }`. Las demás `failed` sí cuentan (cada una costó una llamada).
6. Si no: inserta la ejecución `queued`, encola un job `advisor` con `payload = { "run_id": … }` (con `on conflict … do nothing` sobre el índice parcial; si no encola, marca la ejecución `failed` con `error = 'busy'` y devuelve `running`), audita `advisor.requested` y devuelve `{ "status": "queued", "run_id": …, "used": n + 1, "limit": … }`.

### `advisor_usage(p_organization_id uuid) returns table (used int)`
`security definer`, solo `authenticated` y miembro de la organización (cualquier rol): el mismo conteo del paso 5, para mostrar las consultas restantes.

### `complete_advisor_run(p_run_id uuid, p_status text, p_error text, p_driver text, p_model text, p_input_tokens int, p_output_tokens int, p_items int)`
`security definer`, solo `service_role`. Cierra la ejecución (`done` o `failed`, con `finished_at`). Si es `done` y no está cacheada: marca como `dismissed` los insights `generated_by = 'llm'` de la organización y periodo con `status = 'new'` creados por otra ejecución (`evidence->>'run_id' <> p_run_id`). Los que el usuario vio, resolvió o descartó se conservan.

## pgTAP `supabase/tests/advisor.test.sql`
- `request_advisor`: viewer y un usuario de otra organización reciben `42501`; hash o límite inválidos, `22023`; la primera petición encola un job `advisor` con el `run_id`; con una en curso devuelve `running` sin crear otra; tras completarla `done`, el mismo hash devuelve `cached` y no consume límite; con el límite en 2, la segunda ejecución no cacheada pasa y la tercera devuelve `limit`; un `failed` cuenta; ayer no cuenta.
- `complete_advisor_run`: `done` descarta los `llm` `new` de otra ejecución y conserva los `seen`/`done` y los de esta ejecución; `authenticated` no puede llamarla (`42501`).
- `advisor_usage` devuelve el conteo; un no miembro recibe `42501`.
- RLS: un miembro de A no ve las ejecuciones de B; `authenticated` no inserta ni actualiza `advisor_runs`; `anon` no lee.

## Además
- Tipos en `src/lib/supabase/types.ts` y `docs/DATABASE_SCHEMA.md` (tabla, funciones y flujo de caché y límite).

## Reglas
- Sin TS de aplicación en este corte. Sin librerías nuevas.
- Acentos: antes de terminar, `git diff | grep -nP "[A-Za-z]\?[a-z]"` sin coincidencias.
- `typecheck`, `lint`, `test`, `build` y `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`. pgTAP lo corre Claude Code.
