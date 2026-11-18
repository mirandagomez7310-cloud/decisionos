# F5-01 · Insights: tabla, reglas y estados en SQL (fase 5a, corte 1)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee antes: D-002 y D-031 en `docs/DECISIONS.md`, `docs/DATABASE_SCHEMA.md` (secciones «insights» y «Métricas en SQL»), `supabase/migrations/20261112020000_core.sql` (`my_org_ids`, `my_org_ids_with_role`, `audit_log`, patrón `security definer` con auditoría), `20261113010000_imports_jobs.sql` (`jobs`), `20261114000000_metrics.sql` y `20261118000000_inventory_cash_metrics.sql` (las funciones que las reglas llaman), y `supabase/tests/metrics.test.sql` e `inventory_cash_metrics.test.sql` como modelo de test.

## Migración `supabase/migrations/20261119000000_insights.sql`

### Tabla `public.insights`
Columnas según `DATABASE_SCHEMA.md`: `id`, `organization_id` (FK a `organizations` con `on delete cascade`), `module` (`executive`, `sales`, `profit`, `inventory`, `cash`), `kind` (`fact`, `hypothesis`, `suggestion`; `text` con `check`, no un tipo enum nuevo), `severity` (`info`, `warning`, `critical`), `title`, `body`, `evidence jsonb not null`, `metric_snapshot jsonb not null`, `period_start date not null`, `period_end date not null`, `generated_by` (`rule`, `llm`), `rule_key text`, `status` (`new`, `seen`, `dismissed`, `done`, por defecto `new`), `created_at`, `updated_at` (con el trigger `set_updated_at`).
- `check (kind <> 'fact' or generated_by = 'rule')` y `check (generated_by <> 'rule' or rule_key is not null)`.
- `unique (organization_id, rule_key, period_start)`; índice `(organization_id, status, created_at desc)`.
- RLS: select para `authenticated` con `organization_id in (select public.my_org_ids())`. Sin insert, update ni delete para `authenticated` ni `anon` (`revoke all` y luego `grant select`).

### `evaluate_insight_rules(p_organization_id uuid, p_as_of date)`
`language sql stable security invoker set search_path = ''`; `execute` solo para `service_role` (revocado a `public`, `anon` y `authenticated`). Devuelve `setof` filas `rule_key, module, severity, period_start, period_end, evidence jsonb, metric_snapshot jsonb`, una por regla que dispara. Llama a las funciones de métricas existentes; nada de recalcular a mano lo que ya calculan.

Periodos: **mes cerrado** = mes anterior a `p_as_of` completo (`date_trunc('month', p_as_of) - 1 mes` hasta el último día de ese mes), frente al mes previo a él. **Corte** = `p_as_of`, con `period_start` = día 1 del mes de `p_as_of` y `period_end` = `p_as_of`.

| rule_key | module | Datos | Dispara si | severity |
|---|---|---|---|---|
| `sales_drop` | sales | `metrics_summary` del mes cerrado | `net_sales_change_pct <= -10` (nulo no dispara) | `critical` si `<= -20`, si no `warning` |
| `margin_drop` | profit | `metrics_summary` del mes cerrado | `margin_pct_change_pts <= -3` | `warning` |
| `negative_margin_products` | profit | `metrics_by_product` del mes cerrado | al menos una fila con `gross_margin < 0` | `warning` |
| `low_cost_coverage` | profit | `metrics_summary` del mes cerrado | `coverage < 80` (nula no dispara) | `info` |
| `stale_inventory` | inventory | `inventory_summary` al corte | `stale_share_pct > 20` | `warning` |
| `high_risk_customers` | cash | `receivables_by_customer` al corte | al menos un cliente con `risk = 'alto'` | `critical` |
| `receivables_concentration` | cash | `receivables_summary` al corte | `top5_share_pct > 50` | `info` |
| `overdue_share` | cash | `receivables_summary` al corte | `overdue_pct > 30` | `warning` |

- `metric_snapshot`: las cifras del resumen que justifican la regla (p. ej. `net_sales`, `prev_net_sales`, `net_sales_change_pct`), con los nombres de columna del RPC.
- `evidence`: `{ "metric": "<rpc>", "from": "...", "to": "...", "prev_from": "...", "prev_to": "..." }` y, en las reglas de varios elementos, `"ids"` con hasta 20 ids ordenados por importe (margen más negativo; saldo vencido mayor) y `"count"` con el total.

### `set_insight_status(p_insight_id uuid, p_status text)`
`plpgsql security definer set search_path = ''`, `execute` solo para `authenticated`. Rechaza (`22023`) un estado fuera de `seen`, `dismissed`, `done`, `new`. Actualiza solo si el insight pertenece a una organización en `my_org_ids_with_role('{owner,admin,analyst}')`; si no, `42501`. Inserta en `audit_log` `actor_kind = 'user'`, `action = 'insights.status_changed'`, `entity = 'insights'` y `data` con el estado anterior y el nuevo. Devuelve la fila.

### `enqueue_daily_insights()`
`plpgsql security definer`, `execute` solo para `service_role`. Inserta un job `compute_insights` (`payload = {}`) por organización con ventas, inventario o cuentas por cobrar, salvo si ya tiene uno `queued` o `running`. Devuelve cuántos encoló.

### `jobs`
Amplía el `check` de `jobs.kind` con `compute_insights` (`drop constraint` y `add constraint`; mira el nombre real del constraint generado).

## pgTAP `supabase/tests/insights.test.sql`
Datos a mano en dos organizaciones, con `p_as_of` fijo y fechas relativas a él como en `inventory_cash_metrics.test.sql`. Ejecuta como `service_role` para evaluar y como `authenticated` para los estados. Comprueba con valores exactos:
- Cada regla dispara con su `severity`, `period_start`, `period_end` y las cifras de `metric_snapshot`.
- Bordes: ventas −9,9 % no dispara y −10 % sí (`warning`); −20 % es `critical`; margen −2,9 pts no dispara y −3 sí; cobertura 80 % no dispara; `stale_share_pct` 20 no dispara; `top5` 50 no dispara; `overdue_pct` 30 no dispara.
- Mes anterior sin ventas: `sales_drop` no dispara. Organización sin datos: cero filas.
- `evidence.ids` con el orden pedido y `count` correcto.
- `authenticated` no ejecuta `evaluate_insight_rules` ni `enqueue_daily_insights` (`42501`); `anon` no ve `insights`.
- RLS: un miembro de A no ve los insights de B.
- `set_insight_status`: un analyst de A cambia el estado y deja una fila en `audit_log`; un viewer de A recibe `42501`; un analyst de A con un insight de B recibe `42501`; un estado inválido da `22023`.
- El `check` de `fact` con `generated_by = 'llm'` falla; el `unique` rechaza el segundo insight de la misma regla y mes.
- `enqueue_daily_insights` encola uno por organización con datos y no duplica si ya hay uno en cola.

## Además
- Tipos: `src/lib/supabase/types.ts` con la tabla y los tres RPC, siguiendo el estilo de los existentes.
- `docs/DATABASE_SCHEMA.md`: la tabla tal como queda, las reglas, los RPC y `0005` marcada como escrita.

## Reglas
- Sin TS de aplicación en este corte (el job es F5-02). Sin librerías nuevas.
- Acentos: antes de terminar, `git diff | grep -nP "[A-Za-z]\?[a-z]"` sin coincidencias.
- `typecheck`, `lint`, `test`, `build` y `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`. pgTAP lo corre Claude Code.
