# F3-01 · Métricas en SQL y periodos (fase 3, corte 1)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee `supabase/migrations/20261113000000_business.sql`, `docs/DATABASE_SCHEMA.md` (sección «Métricas en SQL») y `supabase/tests/sales_rls.test.sql` como modelo de test.

## Definiciones (decididas)
- **Venta neta** = `sum(sale_lines.line_total)` de ventas con `status = 'completed'` y `sold_on` en el rango (inclusive). `cancelled` y `returned` no cuentan.
- **Base de margen** = la venta neta de las líneas con `unit_cost is not null`.
- **Margen bruto** = `sum(line_total - quantity * unit_cost)` de esas líneas, redondeado a 2 decimales.
- **Margen %** = `margen_bruto / base_margen * 100`, 1 decimal; `null` si la base es 0.
- **Cobertura** = `base_margen / venta_neta * 100`, 1 decimal; `null` si la venta neta es 0.
- **Variación %** = `(actual - anterior) / anterior * 100`, 1 decimal; `null` si el anterior es 0 («sin comparación»).
- **Variación de margen** en puntos = `margen_pct_actual - margen_pct_anterior`, 1 decimal; `null` si falta alguno.
- Todo con `numeric`; ningún cálculo de dinero en TypeScript.

## Entregables
1. **Migración `supabase/migrations/20261114000000_metrics.sql`**:
   - Vista `public.sale_lines_enriched with (security_invoker = true)`: líneas con `sold_on`, `status`, `customer_id` de su venta (join por la FK compuesta). `grant select` a `authenticated`.
   - Funciones `language sql stable security invoker set search_path = ''`, `grant execute` solo a `authenticated` (revoca de `public` y `anon`). Todas filtran `organization_id = p_organization_id` y solo `status = 'completed'`:
     - `metrics_summary(p_organization_id uuid, p_from date, p_to date, p_prev_from date, p_prev_to date)` → una fila: `net_sales, prev_net_sales, net_sales_change_pct, sales_count, gross_margin, margin_base, margin_pct, prev_margin_pct, margin_pct_change_pts, coverage`.
     - `metrics_daily_sales(p_organization_id uuid, p_from date, p_to date)` → `day date, net_sales numeric`, **un día por fila del rango, con 0 los días sin ventas** (`generate_series`).
     - `metrics_by_product(p_organization_id uuid, p_from date, p_to date, p_prev_from date, p_prev_to date)` → `setof` filas `product_id, sku, name, net_sales, prev_net_sales, delta, delta_pct, gross_margin, margin_pct, coverage`; productos con ventas en cualquiera de los dos periodos.
     - `metrics_by_customer(...)` igual, con `customer_id, code, name`.
     - Las funciones `setof` deben admitir `.order()` y `.range()` de PostgREST (orden y paginación en servidor).
2. **pgTAP `supabase/tests/metrics.test.sql`**: datos a mano en dos organizaciones con importes de céntimos difíciles (p. ej. 0.10 + 0.20, cantidades `1.333`), una venta `cancelled` y una `returned`, una línea sin costo, un día sin ventas. Comprueba con valores exactos: venta neta, margen bruto, margen %, cobertura, variación %, `null` sin periodo anterior, ceros por día en la serie diaria, desglose por producto y cliente. Como `authenticated` miembro de A: con el id de B, el resumen sale en cero y los desgloses vacíos. `anon` no ejecuta ninguna función (`42501`). La vista no devuelve filas de B (prueba de `security_invoker`).
3. **Periodos en TS puro** `src/lib/server/metrics/period.ts` (sin Supabase) con `period.test.ts`:
   - `todayInMexico(now: Date): string` (`YYYY-MM-DD` en `America/Mexico_City`, con `Intl`).
   - `resolvePeriod(kind: 'mtd' | 'last30' | 'prev_month', today: string)` → `{ from, to, prevFrom, prevTo }` en `YYYY-MM-DD`.
     - `mtd`: día 1 del mes hasta hoy, frente al día 1 del mes anterior hasta el mismo día, recortado al último día de ese mes (31 de marzo → 1–28/29 de febrero).
     - `last30`: los 30 días que acaban hoy frente a los 30 anteriores.
     - `prev_month`: el mes anterior completo frente al mes previo a él.
   - Tests: 1 de enero (cambio de año), 31 de marzo, 29 de febrero bisiesto, 30 de abril, último día del año; `todayInMexico` a las 05:30 UTC (todavía es el día anterior en México).
   - `periodSchema` Zod (`@/lib/zod`) para el parámetro `?periodo=` con `mtd` por defecto.
4. `docs/DATABASE_SCHEMA.md`: la vista, las funciones y las definiciones de arriba en «Métricas en SQL», y `0004` marcada como escrita.

## Reglas
- `typecheck`, `lint`, `test`, `build`, `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`. pgTAP lo corre Claude Code.
