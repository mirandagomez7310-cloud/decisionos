# F2-02 · Migración `0003_imports_jobs`, bucket `imports` y tipos generados (fase 2, corte 2)

Brief para Codex. Especificación: `docs/DATABASE_SCHEMA.md` ("Importación y trabajos (fase 2)", "Tests pgTAP" puntos 1–4 y 6). Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Modelo: `supabase/migrations/20261113000000_business.sql` y sus tests.

## Entregables
1. `supabase/migrations/20261113010000_imports_jobs.sql`: `imports`, `import_rows`, `jobs` según el esquema; FK compuesta `(organization_id, source_import_id) references imports(organization_id, id)` añadida a `sales`, `inventory_snapshots` y `receivables`; función `claim_job`; bucket `imports` y políticas en `storage.objects`; RLS, políticas y grants.
2. Tests pgTAP `imports_rls`, `import_rows_rls`, `jobs_rls` y `storage_imports.test.sql` (punto 6: un miembro de A no lista, lee ni sube en el prefijo de B).
3. Tipos: `src/lib/supabase/database.types.ts` ya existe (generado por Claude Code con `supabase gen types`; **no lo edites**, se regenera). Convierte `src/lib/supabase/types.ts` en un módulo fino que re-exporte `Database` desde el generado y derive lo que el código usa (`OrgRole = Database['public']['Enums']['org_role']`, `Json`, etc.); elimina los tipos escritos a mano. Ajusta los imports que haga falta. Nota: el generado aún no incluye `imports`/`jobs` (los regenera Claude Code tras aplicar tu migración); no dependas de ellos en código de esta entrega.
4. `docs/DATABASE_SCHEMA.md`: encabezado «`0003_imports_jobs` escrita (pendiente de verificación)» y ajustes que la migración obligue.

## Decisiones que el esquema deja abiertas (resueltas aquí)
- **`imports`**: `select` para cualquier miembro de la organización; `insert` solo `owner/admin` con `created_by = auth.uid()` y `status = 'pending'` (grant `insert` por columnas: `organization_id, kind, storage_path, original_filename, column_mapping, created_by`); sin `update`/`delete` para `authenticated` (el job y la reversión van por clave de servicio). `storage_path` con `check (storage_path like organization_id::text || '/%')`.
- **`import_rows`**: `select` solo `owner/admin`; sin escritura para `authenticated`. FK compuesta a `imports`; índice `(import_id, row_number)`.
- **`jobs`**: `select` para miembros de la organización (`organization_id in my_org_ids()`; las filas con `organization_id null` no se exponen); sin escritura para `authenticated`. `kind` con `check (kind in ('import', 'revert_import'))` (crecerá con `alter`). Índice parcial `(run_after) where status = 'queued'`.
- **`claim_job(worker text, kinds text[])`**: `security definer`, `set search_path = ''`, `revoke execute from public, anon, authenticated` (solo `service_role`). Toma un job `queued` con `run_after <= now()` y `attempts < max_attempts` usando `for update skip locked`, lo pasa a `running`, fija `locked_at`, `locked_by`, `attempts + 1` y lo devuelve; `null` si no hay. También `complete_job(id, status, last_error)` que fija `done`/`failed`, `finished_at` y, si `failed` con intentos restantes, lo vuelve a `queued` con `run_after = now() + interval '1 minute' * attempts`. Un trigger `set_updated_at` no aplica (no hay `updated_at`).
- **Bucket `imports`**: `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)` privado, 25 MB, tipos `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`, `text/plain`. Políticas en `storage.objects` para `authenticated`: `select` e `insert` solo `owner/admin` cuando `bucket_id = 'imports'` y `(storage.foldername(name))[1] in (select id::text from public.my_org_ids_with_role('{owner,admin}') as id)`; sin `update`/`delete` (borrado por servicio al revertir). Si la pila local no permite políticas en `storage.objects` desde una migración, dilo y deja el SQL en `supabase/migrations/` igualmente marcado con comentario.
- El test de storage inserta en `storage.objects` como `authenticated` con claims de un owner de A: `A/x.csv` ok, `B/x.csv` denegado (`42501`), lista (`select`) de `B/` vacía.

## Reglas
- No modifiques `0001_core` ni `0002_business` salvo las FKs indicadas, que van en la nueva migración con `alter table … add constraint`.
- `typecheck`, `lint`, `test`, `build` en verde (el cambio de tipos lo exige). `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · desviaciones y por qué · qué comprobaste · `git status --short`.
