# F5-02 · Job `compute_insights` (fase 5a, corte 2)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee antes: D-031, `supabase/migrations/20261119000000_insights.sql` (la entregaste en F5-01), `src/lib/server/jobs/` completo (`index.ts`, `shared.ts`, `handlers/*`, tests), `src/lib/server/metrics/period.ts` (`todayInMexico`), `src/lib/format.ts` y `src/lib/supabase/types.ts`.

## 1. Encolar sin chocar con el índice parcial (SQL)
El índice único `jobs_active_compute_insights_idx` es parcial y PostgREST no puede usarlo como `onConflict`. Añade **en la misma migración `20261119000000_insights.sql`** (todavía no está en `master`):
- `enqueue_insights(p_organization_id uuid) returns boolean`, `plpgsql security definer set search_path = ''`, `execute` solo para `service_role`. Inserta un `compute_insights` con `on conflict ... do nothing`, igual que `enqueue_daily_insights`; devuelve `true` si encoló.
- pgTAP en `supabase/tests/insights.test.sql`: encola, no duplica con uno en cola y `authenticated` recibe `42501`. Ajusta `plan()`.
- Tipos en `types.ts`.

Límite conocido (aceptado): si una importación termina mientras corre un cálculo, el nuevo no se encola y sus datos se evalúan en el siguiente cálculo. El índice cubre `running` a propósito, porque `complete_job` devuelve a `queued` un job fallido con reintentos y dos en cola violarían el índice.

## 2. Texto de cada insight (TS puro)
`src/lib/server/insights/describe.ts`: `describeInsight(candidate)` → `{ title, body }`, donde `candidate` es una fila de `evaluate_insight_rules`. Las cifras salen de `metric_snapshot` y `evidence`, sin aritmética: solo formatea con `src/lib/format.ts`. Para el mes añade `formatMonth('2026-10-01')` → «octubre 2026» en `format.ts` (con test). Textos:

| rule_key | title | body |
|---|---|---|
| `sales_drop` | «Las ventas de {mes} cayeron {pct}» | «Venta neta de {net_sales} frente a {prev_net_sales} el mes anterior.» |
| `margin_drop` | «El margen de {mes} bajó {pts}» | «Margen de {margin_pct} frente a {prev_margin_pct} el mes anterior.» |
| `negative_margin_products` | «{count} productos vendieron con pérdida en {mes}» (singular si es 1) | «El peor margen bruto es {gross_margin}.» |
| `low_cost_coverage` | «Solo el {coverage} de las ventas de {mes} tiene costo» | «El margen se calcula sobre {margin_base} de {net_sales}. Importa los costos para completarlo.» |
| `stale_inventory` | «{stale_share_pct} del inventario no se ha movido en 90 días» | «{stale_value} de {inventory_value} en existencias sin ventas.» |
| `high_risk_customers` | «{count} clientes con riesgo alto de cobranza» (singular si es 1) | «Tienen saldo a más de 90 días o superan su límite de crédito. El mayor vencido es {overdue_balance}.» |
| `receivables_concentration` | «5 clientes concentran el {top5_share_pct} de la cobranza» | «Saldo por cobrar total: {open_balance}.» |
| `overdue_share` | «El {overdue_pct} de la cobranza está vencido» | «{overdue_balance} vencidos de {open_balance} por cobrar.» |

Las cifras `numeric` llegan como `number` o `string` desde el JSON: conviértelas con `Number()` solo para formatear. Un `rule_key` desconocido lanza un error (no se inventa texto). Test con cada regla, el singular y el plural, y el valor negativo con `−`.

## 3. Handler `src/lib/server/jobs/handlers/insights.ts`
`handleComputeInsights(db, job)`:
1. Exige `job.organization_id` (sin él, error).
2. `evaluate_insight_rules({ p_organization_id, p_as_of: todayInMexico(new Date()) })`.
3. Inserta con `upsert(rows, { onConflict: 'organization_id,rule_key,period_start', ignoreDuplicates: true })`, con `organization_id` explícito, `kind: 'fact'`, `generated_by: 'rule'` y `status: 'new'`.
4. Audita `insights.computed` con `data: { candidates, rules: [...] }`. Generaliza `audit` en `shared.ts` para aceptar `entity` y `entityId` sin romper sus llamadas actuales (por defecto, `imports` e `importId(job)`).

## 4. Integración
- `runPendingJobs`: reclama `['import', 'revert_import', 'compute_insights']` y despacha por `kind`. En el fallo definitivo solo marca `imports` como `failed` si el job es `import` o `revert_import` (hoy lo hace siempre y `importId` lanzaría con un `compute_insights`).
- `handleImport` (después de `imports.completed`) y `handleRevert` (después de `imports.reverted`): `enqueue_insights(organization_id)`. Como el bucle de `runPendingJobs` reclama hasta 5 jobs, el cálculo corre en la misma pasada que la importación.

## Tests (Vitest, doble del cliente como en `handlers/import.test.ts` y `worker.test.ts`)
- El handler llama a `evaluate_insight_rules` con la fecha de México, inserta con `ignoreDuplicates` y los campos fijos, y audita. Sin candidatos: no inserta y audita `candidates: 0`.
- Sin `organization_id`: lanza.
- `runPendingJobs`: despacha `compute_insights`; su fallo definitivo no toca `imports`.
- `handleImport` y `handleRevert` encolan `enqueue_insights` al terminar.
- `describeInsight` y `formatMonth`, como arriba.

## Reglas
- Sin UI en este corte. Sin librerías nuevas. Nada de aritmética de dinero en TS.
- Acentos: antes de terminar, `git diff | grep -nP "[A-Za-z]\?[a-z]"` sin coincidencias.
- `typecheck`, `lint`, `test`, `build` y `playwright test --list` en verde (los E2E de importación siguen pasando: el job extra no cambia lo que ven). `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`. pgTAP y E2E los corre Claude Code.
