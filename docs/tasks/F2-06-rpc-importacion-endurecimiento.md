# F2-06 · Importación en SQL (rendimiento), reversión por RPC y endurecimientos (fase 2, corte 6)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee `src/lib/server/jobs/handlers/{import,revert}.ts`, `src/features/imports/actions.ts` y `supabase/migrations/20261113010000_imports_jobs.sql`.

## Hechos medidos por Claude Code en la pila local (2026-11-13)
- Importar 10 000 líneas de venta (2 000 folios × 5) con el worker actual: **66,8 s**. Causa: una ida y vuelta a PostgREST por venta (borrar líneas + insertar) y por lote de catálogo. Objetivo: **< 8 s** para esas 10 000 líneas en local.
- Revertir esa importación: **falla con `URI too long`** (`.in('sale_id', [2 000 ids])` va en la URL). El job se reencola y vuelve a fallar hasta agotar intentos.
- `EXPLAIN (ANALYZE)` sobre `sale_lines` con 10 000 filas como owner: 4 ms; la política RLS se evalúa una vez (subplan hasheado). No hay nada que optimizar ahí.
- Revisión de seguridad automática: (a) `imports.storage_path` solo exige el prefijo `<org>/`, así que un admin podría insertar por la API REST `A/../B/archivo.csv` y la descarga con clave de servicio normalizaría la URL y leería el archivo de B; (b) comparación del `JOBS_SECRET` con `!==` (no es tiempo constante).

## Entregables
1. **Migración `supabase/migrations/20261113020000_imports_rpc.sql`** (no edites las anteriores):
   - `alter table public.imports drop constraint <check actual de storage_path>` y nuevo `check (storage_path ~ ('^' || organization_id::text || '/[0-9a-f-]{36}-[A-Za-z0-9._-]+$'))` (sin barras ni `..` tras el prefijo). Comprueba que `sanitizeFilename` de `src/features/imports/schemas.ts` produce nombres que cumplen esa expresión; ajústalo si no.
   - `imports.preview jsonb not null default '[]'`: primeras 20 filas válidas que `saveMapping` guarda al validar, para que la página no vuelva a descargar y parsear el archivo en cada render (`previewImport` en `queries.ts` pasa a leer esa columna).
   - `public.apply_import_sales(p_organization_id uuid, p_import_id uuid, p_rows jsonb) returns table (inserted_sales int, inserted_lines int)`: `security definer`, `set search_path = ''`, ejecutable solo por `service_role`. Recibe las filas ya validadas (`external_ref, sold_on, customer_code, customer_name, product_sku, product_name, quantity, unit_price, unit_cost, discount, line_total, status, currency, tax`) y hace todo en conjuntos: `insert … on conflict do nothing` de clientes y productos nuevos que traigan nombre; `insert … on conflict (organization_id, external_ref) do update` de cabeceras (subtotal = suma de `line_total`, `total = subtotal + tax`, `source_import_id`); `delete from sale_lines where sale_id in (select id from sales where organization_id = … and external_ref = any(…))` e `insert` de todas las líneas con una sola sentencia desde `jsonb_to_recordset`. Las filas cuyo cliente o producto no exista ni traiga nombre se devuelven en una tercera columna `rejected jsonb` (external_ref, row_number, motivo) para que el worker las escriba en `import_rows`.
   - Equivalentes `apply_import_products`, `apply_import_customers`, `apply_import_inventory`, `apply_import_receivables` (upsert en conjunto; `receivables.sale_id` resuelto por `sale_external_ref` en la misma sentencia).
   - `public.revert_import(p_organization_id uuid, p_import_id uuid) returns void`: borra `sale_lines` (por `sale_id` de ventas con ese `source_import_id`), `sales`, `inventory_snapshots`, `receivables` e `import_rows` del import, y pone `imports.status = 'reverted'`. Solo `service_role`.
   - Todas las funciones exigen que `p_organization_id` coincida con `imports.organization_id` del `p_import_id` (si no, `raise exception` `42501`).
2. **Worker**: `handlers/import.ts` envía lotes de hasta 2 000 filas a la RPC (una llamada por lote), actualiza `jobs.progress` por lote y escribe las `rejected` en `import_rows`; `handlers/revert.ts` llama a `revert_import`. Mantén los tests con cliente simulado; actualízalos.
3. **`actions.ts`**: `saveMapping` descarga el archivo con el cliente de usuario (`db.storage`, aplica la política de storage), no con el de servicio; guarda `preview`. `route.ts`: comparación con `timingSafeEqual` de `node:crypto` sobre buffers de igual longitud (si difiere la longitud, 401).
4. **pgTAP** `supabase/tests/imports_rpc.test.sql`: `authenticated` no puede ejecutar ninguna RPC nueva (`42501`); el `check` nuevo rechaza `A/../B/x.csv` y `A/sub/x.csv` y acepta `A/<uuid>-x.csv`; `apply_import_sales` con 2 folios y 3 líneas crea cliente y producto nuevos, reimportar el mismo folio reemplaza sus líneas (no duplica), una fila con producto desconocido sin nombre vuelve en `rejected`; `revert_import` deja la organización sin ventas de ese import y no toca las de otro; con `p_organization_id` de otra organización, `42501`. Actualiza `plan()`.
5. `docs/DATABASE_SCHEMA.md`: nuevas funciones y columna `preview`.

## Reglas
- Cálculos de dinero en SQL con `numeric`, nunca en JS flotante.
- `typecheck`, `lint`, `test`, `build`, `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`. La medición de los 10 000 registros y pgTAP los corre Claude Code.
