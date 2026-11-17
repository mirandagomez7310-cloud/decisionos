# F4-01 · Métricas de inventario y cobranza en SQL (fase 4, corte 1)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee `supabase/migrations/20261113000000_business.sql` (`inventory_snapshots`, `receivables`, `customers.credit_limit`), `supabase/migrations/20261114000000_metrics.sql` (modelo de vista, funciones, grants y estilo), `supabase/tests/metrics.test.sql` (modelo de test) y `docs/DATABASE_SCHEMA.md` («Métricas en SQL»).

Objetivo de la fase (ROADMAP): «rotación y días de inventario, inventario sin movimiento, antigüedad de saldos, concentración y riesgo por cliente». Este corte solo deja las cifras en SQL; las pantallas llegan en F4-02 y F4-03.

## Definiciones (decididas en D-030)
Fecha de corte `p_as_of` (la calcula TS con `todayInMexico`). Todo con `numeric`; ningún cálculo de dinero en TypeScript.

**Inventario**
- **Fecha de existencias** = la última `snapshot_on <= p_as_of` de la organización. Solo cuentan las filas de esa fecha (no se mezcla el último snapshot de cada producto: un producto ausente en el último corte no tiene existencia).
- **Costo unitario** = `inventory_snapshots.unit_cost`, y si es nulo `products.standard_cost`.
- **Valor de inventario** = `sum(quantity * costo_unitario)` de las filas con `quantity > 0` y costo no nulo, redondeado a 2 decimales.
- **Cobertura de valor** = filas con `quantity > 0` y costo / filas con `quantity > 0` × 100, 1 decimal; `null` sin filas.
- **Costo de lo vendido 90 d** = `sum(quantity * unit_cost)` de líneas de ventas `completed` con `sold_on` en `(p_as_of - 89) .. p_as_of` y `unit_cost` no nulo.
- **Días de inventario** = `valor_inventario / (costo_vendido_90d / 90)`, 1 decimal; `null` si el costo vendido es ≤ 0.
- **Rotación anual** = `costo_vendido_90d * 365 / 90 / valor_inventario`, 1 decimal; `null` si el valor es 0.
- **Sin movimiento** = producto con `quantity > 0` en la fecha de existencias y sin líneas `completed` en los 90 días hasta `p_as_of` (incluye los que nunca se vendieron). `last_sold_on` = última `sold_on` `completed` ≤ `p_as_of`, o `null`.

**Cobranza**
- **Saldo** = `amount - paid_amount` de cuentas con `issued_on <= p_as_of` y saldo > 0.
- **Días vencidos** = `p_as_of - due_on` (≤ 0 = por vencer).
- **Tramos**: por vencer (≤ 0), 1–30, 31–60, 61–90, más de 90.
- **Concentración** = saldo del cliente / saldo total × 100, 1 decimal; en el resumen, la de los 5 clientes con más saldo.
- **Uso de crédito** = saldo / `credit_limit` × 100, 1 decimal; `null` sin límite o límite 0.
- **Riesgo** (regla determinista, texto): `alto` si tiene saldo a más de 90 días o uso de crédito > 100; `medio` si tiene saldo a más de 30 días; `bajo` en otro caso.

## Entregables
1. **Migración `supabase/migrations/20261118000000_inventory_cash_metrics.sql`**. Funciones `language sql stable security invoker set search_path = ''`, `grant execute` solo a `authenticated` (revoca de `public` y `anon`), todas filtran `organization_id = p_organization_id`, como en `metrics.sql`:
   - `inventory_summary(p_organization_id uuid, p_as_of date)` → una fila: `snapshot_on, inventory_value, value_coverage, cogs_90d, days_on_hand, turnover, stale_value, stale_count, product_count`. Sin snapshot: `snapshot_on` nulo y cifras en 0 o nulas según la definición.
   - `inventory_by_product(p_organization_id uuid, p_as_of date)` → `setof`: `product_id, sku, name, quantity, unit_cost, inventory_value, cogs_90d, days_on_hand, last_sold_on, days_since_sale, is_stale`. Solo productos de la fecha de existencias con `quantity > 0`.
   - `receivables_summary(p_organization_id uuid, p_as_of date)` → una fila: `open_balance, overdue_balance, overdue_pct, current_balance, d1_30, d31_60, d61_90, d90_plus, customer_count, top5_share_pct`.
   - `receivables_by_customer(p_organization_id uuid, p_as_of date)` → `setof`: `customer_id, code, name, open_balance, overdue_balance, current_balance, d1_30, d31_60, d61_90, d90_plus, max_days_overdue, credit_limit, credit_used_pct, share_pct, risk`. Solo clientes con saldo > 0.
   - Las funciones `setof` deben admitir `.order()` y `.range()` de PostgREST.
   - Índice si hace falta para la última venta por producto (`sale_lines(organization_id, product_id)` ya existe; justifica cualquier otro en el informe).
2. **pgTAP `supabase/tests/inventory_cash_metrics.test.sql`**: datos a mano en dos organizaciones. Comprueba con valores exactos:
   - Dos fechas de snapshot (la posterior a `p_as_of` no cuenta); producto ausente del último corte; fila con `quantity = 0`; costo nulo que cae a `standard_cost` y otro sin ninguno (cobertura < 100); costo vendido con céntimos difíciles; producto sin venta en 90 días y otro vendido justo el día 90 (no es sin movimiento) y el 91 (sí lo es); venta `cancelled` que no cuenta como movimiento.
   - Cuentas: pagada del todo (fuera), parcial, vencida exactamente 30, 31, 90 y 91 días, emitida después de `p_as_of` (fuera), cliente sin límite y otro por encima del límite; un caso de cada riesgo.
   - Sin snapshots ni cuentas: resúmenes sin error, desgloses vacíos.
   - Como `authenticated` miembro de A con el id de B: resúmenes vacíos o en cero y desgloses vacíos. `anon` no ejecuta ninguna función (`42501`).
3. **Tipos**: amplía `src/lib/supabase/types.ts` con las cuatro funciones, como `metrics_by_product`.
4. `docs/DATABASE_SCHEMA.md`: las funciones y las definiciones de arriba en «Métricas en SQL».

## Casos límite cubiertos
Organización sin inventario o sin cuentas · snapshot posterior a la fecha de corte · costos nulos (cobertura) · costo vendido 0 (días nulos) · bordes de 90 días y de tramos · pagos parciales · límite de crédito nulo o 0 · aislamiento entre organizaciones.

## Reglas
- Sin UI en este corte. Sin librerías nuevas.
- Acentos: antes de terminar, `git diff | grep -nP "[A-Za-z]\?[a-z]"` sin coincidencias.
- `typecheck`, `lint`, `test`, `build`, `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`. pgTAP lo corre Claude Code.
