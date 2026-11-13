# F2-04 · Asistente de importación y catálogo (fase 2, corte 4)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Usa `src/lib/server/imports/` (F2-03), los tipos de `@/lib/supabase/types` y los patrones de la fase 1: página de miembros (`src/app/(app)/o/[slug]/settings/members/page.tsx`), acciones (`src/features/members/actions.ts`: Zod + `requireRoleForAction` + errores como datos), formularios con `useActionState` (F1-05d). Mínimo JS en cliente: Server Components salvo los controles que reaccionan.

## Rutas (`src/app/(app)/o/[slug]/`)
- `imports/page.tsx`: lista de importaciones de la organización (tipo, archivo, estado, filas ok/error, fecha, enlace) y botón «Nueva importación» (owner/admin; el resto solo lee).
- `imports/new/page.tsx`: paso 1, formulario (`kind` con `select` nativo + `input type=file` accept `.csv,.xlsx`) → acción `uploadImport`.
- `imports/[id]/map/page.tsx`: paso 2, un `select` por campo canónico del `kind` con las cabeceras del archivo (preseleccionado con `suggestMapping`), requeridos marcados → acción `saveMapping` → redirige al paso 3.
- `imports/[id]/page.tsx`: paso 3 y seguimiento: resumen (`row_count`, `ok_count`, `error_count`), primeras 20 filas válidas, lista de errores por fila (`import_rows` con `error`), botón «Importar N filas válidas» (acción `confirmImport`, deshabilitado si `ok_count = 0`), estado del job (`jobs` de la organización con `payload->>'import_id'`), «Revertir» cuando `status = 'done'` (acción `revertImport`). Mientras `status = 'processing'`, una isla cliente mínima que llama a `router.refresh()` cada 3 s.
- `catalog/products/page.tsx` y `catalog/customers/page.tsx`: listas en servidor con búsqueda (`?q=`) por sku/code o nombre, orden y paginación como la página de miembros; todos los roles.
- Enlaces «Importaciones» y «Catálogo» en el `nav` de `o/[slug]/layout.tsx`.

## Acciones (`src/features/imports/actions.ts`, Zod en `schemas.ts`)
Todas: `requireRoleForAction(organizationId, 'owner', 'admin')`, errores como datos, `audit_log` con `action` `imports.<evento>` (prefijo plural, como `members.*`).
- `uploadImport(FormData)`: valida `kind`, tamaño ≤ 25 MB y extensión; sube con el cliente de usuario a `imports/<organization_id>/<uuid>-<nombre saneado>` (la política de storage hace cumplir el prefijo); llama a `parseFile` para obtener cabeceras y `row_count`; inserta en `imports` (`status = 'pending'`, `column_mapping = suggestMapping(...)`) con el cliente de usuario; redirige a `map`.
- `saveMapping`: valida con `validateMapping`; `imports.column_mapping` lo escribe el cliente de servicio (`createAdminClient`) tras `requireRoleForAction`, con `organization_id` explícito y entrada en `audit_log` (regla del proyecto para el camino de servicio). Después ejecuta la validación: descarga el archivo (servicio), `parseFile` + `validateRows` con `currency` de la organización, borra `import_rows` previas del import, inserta las filas con error (`raw`, `error`), actualiza `row_count/ok_count/error_count`. Redirige al paso 3.
- `confirmImport`: solo si `status = 'pending'` y `ok_count > 0`; inserta en `jobs` (`kind = 'import'`, `payload = { import_id }`, `organization_id`), pone `imports.status = 'processing'`, audita y llama a `runPendingJobs()` dentro de `after()` (`next/server`). `runPendingJobs` llega en F2-05: crea `src/lib/server/jobs/index.ts` con esa función exportada como stub que no hace nada y un comentario `shortcut: F2-05`.
- `revertImport`: solo si `status = 'done'`; job `revert_import`, `imports.status = 'processing'`, audita, `after(runPendingJobs)`.

## Reglas
- Accesibilidad como en la fase 1: `label` para cada control, `role="alert"` para errores, foco visible, tabla semántica.
- Copy en español, formato `es-MX` para números y fechas.
- Tests Vitest para `schemas.ts` y para la lógica pura que añadas (p. ej. saneado del nombre de archivo). Añade a `e2e/` un spec `imports.spec.ts` con `test.fixme` por caso (upload → mapeo → validación → confirmar → revertir; viewer no accede a «Nueva importación»); los E2E reales se completan en F2-05 cuando exista el worker.
- `typecheck`, `lint`, `test`, `build` y `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones donde el brief dejaba margen · comprobaciones · `git status --short`.
