# F2-01 · Migración `0002_business` + tests pgTAP (fase 2, corte 1)

Brief para Codex. Especificación: `docs/DATABASE_SCHEMA.md` (convenciones, "Datos de negocio (fase 2)", "Tests pgTAP"). Este brief solo resuelve lo que el documento deja abierto. Límites de entorno: `docs/tasks/F1-01-scaffold.md`; además, sin `supabase`, `test:e2e` ni `lhci` desde tu sandbox (D-027): la migración la ejecuta Claude Code con `scripts/verify.ps1`. Archivos en UTF-8 sin BOM. Toma como modelo `supabase/migrations/20261112020000_core.sql` y `supabase/tests/memberships_rls.test.sql`.

## Entregables
1. `supabase/migrations/20261113000000_business.sql`: `products`, `customers`, `sales`, `sale_lines`, `inventory_snapshots`, `receivables`, tal como las define el esquema (columnas, tipos `numeric`, `unique (organization_id, id)`, FKs compuestas, índices), trigger `set_updated_at` en las que tienen `updated_at`, RLS y políticas, grants mínimos.
2. `supabase/tests/<tabla>_rls.test.sql` para las seis tablas (puntos 1 a 4 de "Tests pgTAP"; el 5 y el 6 no aplican aún). Cuenta las aserciones en `plan()`.
3. `docs/DATABASE_SCHEMA.md`: encabezado con «`0002_business` escrita (pendiente de verificación)» y cualquier ajuste que la migración obligue (dilo en el informe).

## Decisiones que el esquema deja abiertas (resueltas aquí)
- **Escritura solo por el camino de servicio.** Los datos de negocio entran por importaciones (job con clave de servicio, `organization_id` explícito, entrada en `audit_log`). Para `authenticated`: política `select` para cualquier miembro (`organization_id in (select public.my_org_ids())`) y **ninguna** política de `insert`/`update`/`delete`; `revoke all … from public, anon, authenticated` y `grant select` únicamente. El test de cada tabla comprueba que `owner` tampoco escribe y que la fila sigue intacta.
- `source_import_id uuid null` se crea sin FK: la tabla `imports` llega en `0003_imports_jobs`, que añadirá la FK compuesta.
- `sales.status` y `sales.currency`: `check` como en el esquema; `currency` por defecto `'MXN'`.
- `sale_lines.line_total`: columna normal (viene del origen); sin columna generada, para que el importador pueda detectar discrepancias y marcarlas por fila.
- `receivables.paid_amount` con `check (paid_amount >= 0 and paid_amount <= amount)`; `amount > 0`; `sale_lines.quantity <> 0` (devoluciones con cantidad negativa se permiten); `unit_price >= 0`.
- Índices adicionales: `sale_lines (organization_id, sale_id)`, `receivables (organization_id, due_on)`, `inventory_snapshots (organization_id, snapshot_on)`.
- Datos de prueba en los tests: inserta como `postgres` (sin RLS) dos organizaciones y filas en cada tabla para A y B; luego, con `set local role authenticated` y claims de un `owner` de A, prueba lectura de A, lectura vacía de B, escrituras denegadas (`42501`) y que una FK compuesta rechaza una línea de venta de A que apunte a un producto de B (`23503`), insertando como `postgres`.

## Reglas
- Toda política `<tabla>_<acción>` y `to authenticated`; nunca una función que reciba la columna.
- No modifiques `0001_core` ni los tests de la fase 1.
- `typecheck`, `lint` y `test` deben seguir en verde (no deberían verse afectados). `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · desviaciones respecto al esquema y por qué · qué comprobaste · `git status --short`.
