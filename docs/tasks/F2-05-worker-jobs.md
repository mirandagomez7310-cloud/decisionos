# F2-05 · Worker de jobs: importar y revertir (fase 2, corte 5)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee `docs/ARCHITECTURE.md` (flujo de datos, D-010) y `docs/DATABASE_SCHEMA.md`.

## Entregables (`src/lib/server/jobs/`)
1. `index.ts`: `runPendingJobs({ maxJobs = 5, worker = 'web' })`: con `createAdminClient` llama a `claim_job(worker, kinds)` en bucle; ejecuta el handler por `kind`; `complete_job(id, 'done' | 'failed', last_error)`. Nunca lanza: captura, registra en `last_error` y sigue. Un job que supere `max_attempts` queda `failed` y el import pasa a `failed`.
2. `handlers/import.ts`: descarga el archivo de storage, `parseFile` + `validateRows` con el `column_mapping` guardado, y escribe en lotes de 500 con el cliente de servicio y `organization_id` explícito:
   - `products` / `customers`: `upsert` por `(organization_id, sku | code)`; campos ausentes no sobrescriben (`null` en el archivo deja el valor existente).
   - `sales`: agrupa filas por `external_ref` (cabecera: `sold_on`, cliente, `status`, `currency`, `tax`; `subtotal` = suma de `line_total`, `total = subtotal + tax`); `upsert` de cabecera por `(organization_id, external_ref)` con `source_import_id`; borra las `sale_lines` previas de esa venta e inserta las nuevas (reimportar el mismo folio reemplaza, no duplica). Clientes y productos desconocidos: si la fila trae `customer_name` / `product_name`, se crean; si no, la fila se marca con error en `import_rows` y se omite.
   - `inventory`: `upsert` por `(organization_id, product_id, snapshot_on)`.
   - `receivables`: `upsert` por `(organization_id, external_ref)`; `sale_id` resuelto por `sale_external_ref` si existe.
   - Progreso en `jobs.progress` (`{ done, total }`) cada lote. Al terminar: `imports.status = 'done'`, `finished_at`, `ok_count` / `error_count` definitivos, `audit_log` `imports.completed` (`actor_kind = 'system'`).
   - Idempotencia: si el job se reintenta a mitad, los `upsert` lo hacen seguro; documenta en un comentario qué pasa con las `sale_lines` de una venta cortada a medias (se reemplazan completas en el reintento).
3. `handlers/revert.ts`: borra `sale_lines` → `sales`, `inventory_snapshots` y `receivables` con `source_import_id = import_id`; borra `import_rows`; `imports.status = 'reverted'`; audita. Productos y clientes no se revierten (sin `source_import_id`): documéntalo en `docs/DATABASE_SCHEMA.md` y en el copy del botón.
4. `src/app/api/jobs/run/route.ts` (`POST`): barre pendientes para un cron externo. Autoriza con cabecera `Authorization: Bearer <JOBS_SECRET>`; añade `JOBS_SECRET` a `src/env.ts` (servidor) y a `.env.example`. Sin cabecera válida → 401 sin cuerpo.
5. Tests Vitest de la lógica pura (agrupación de ventas, cálculo de cabecera, lotes) con el cliente de Supabase simulado (mock mínimo del encadenado que uses). Nada de base de datos real en Vitest.
6. `e2e/imports.spec.ts`: sustituye los `fixme` de F2-04 por tests reales con una fixture CSV de ventas de unas 30 filas (2 folios repetidos, 1 fila con cantidad no numérica, 1 producto nuevo con nombre): subir → mapear → validar (1 error) → importar → esperar `done` → ver el producto nuevo en el catálogo → revertir → la venta desaparece. Y: viewer no ve «Nueva importación».
7. `scripts/perf-import.ts` (o test Vitest marcado `skip` por defecto): genera un CSV de 10 000 líneas de venta y mide el tiempo de `parseFile + validateRows`; reporta la cifra. El tiempo de escritura lo mide Claude Code con la pila local.

## Reglas
- Camino de servicio: siempre `organization_id` explícito en cada consulta y entrada en `audit_log`.
- Dinero como `string` decimal hasta la base; nunca `parseFloat` para sumar: usa enteros de centésimas (BigInt o `number` entero con límite comprobado) con test.
- `typecheck`, `lint`, `test`, `build`, `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · cifra de `perf-import` · comprobaciones · `git status --short`.
