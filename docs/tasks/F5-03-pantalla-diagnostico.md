# F5-03 · Pantalla Diagnóstico y bloque en Inicio (fase 5a, corte 3)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee antes: D-002 y D-031, `supabase/migrations/20261119000000_insights.sql` (tabla `insights` y `set_insight_status`), `src/lib/server/insights/describe.ts`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/surfaces/src-app-app-o-slug-page-tsx.md`, `src/features/analysis/` (componentes compartidos), `src/features/receivables/page.tsx` (etiquetas de riesgo), `src/components/empty-import.tsx`, `src/features/dashboard/queries.ts` y `src/app/(app)/o/[slug]/page.tsx`, un Server Action existente (`src/features/invitations/actions.ts`) y `e2e/fixtures.ts`. Este Next.js tiene cambios incompatibles con lo que conoces: consulta `node_modules/next/dist/docs/` si dudas de una API (Server Actions, `revalidatePath`, `searchParams`). No copies texto del contrato visual en el código.

Pregunta que responde: **¿qué debería mirar primero y por qué?** Cada insight dice qué pasó, con qué cifras y dónde ver la evidencia.

## Datos (`src/features/insights/queries.ts`, `server-only`)
- `requireRole(slug, …todos los roles)` y cliente de usuario (RLS).
- `schemas.ts` (Zod desde `@/lib/zod`) para `searchParams`: `estado` (`nuevos` | `vistos` | `hechos` | `descartados`, por defecto `nuevos`) y `modulo` (`todos` | `sales` | `profit` | `inventory` | `cash`, por defecto `todos`). Inválidos: `role="alert"` con «Restablecer filtros».
- `select` de `insights` filtrando estado y módulo, `order('created_at', desc)`, `limit(100)`. Ordena en TS por gravedad (`critical`, `warning`, `info`) y después por fecha: el orden alfabético de `severity` no sirve en SQL y el volumen es bajo (8 reglas al mes). Conteo por estado para el conmutador (cuatro `count: 'exact'` con `head: true`).
- `canChange` = rol `owner`, `admin` o `analyst`.

## Cambio de estado (`src/features/insights/actions.ts`, `'use server'`)
- `setInsightStatus(formData)`: Zod (`slug`, `id` uuid, `status` en `seen` | `done` | `dismissed` | `new`) → `requireRole(slug, 'owner', 'admin', 'analyst')` → RPC `set_insight_status` con el cliente de usuario → `revalidatePath` de la pantalla y de Inicio. Errores como datos, nunca lanzados al cliente. Sigue el patrón de `invitations/actions.ts`.
- Formularios por insight, sin JS de cliente obligatorio. En `nuevos`: «Marcar como visto», «Hecho» y «Descartar». En `vistos`: «Hecho» y «Descartar». En `hechos` y `descartados`: «Reabrir» (`new`). El viewer no ve los formularios.

## Pantalla (`/o/[slug]/insights`)
- Cabecera: título «Diagnóstico» y debajo «Hallazgos calculados a partir de tus datos importados».
- Fila de control: conmutador de estado con su número («Nuevos (3)», enlaces con `aria-current`) y filtro de módulo (Todos · Ventas · Margen · Inventario · Cobranza, enlaces que conservan `estado`).
- Lista (`<ol>`, sin tarjetas): cada insight es un `<article>` con:
  - etiqueta de gravedad con texto y borde: `critical` → «Crítico», con el patrón «Riesgo»; `warning` → «Atención», con borde neutro; `info` → «Dato», sin borde, en `--muted`;
  - etiqueta de módulo en condensada (Ventas, Margen, Inventario, Cobranza);
  - `title` como `<h2>`, `body` como párrafo;
  - periodo: si `period_start` y `period_end` abarcan un mes completo, `formatMonth`; si no, «Corte al {formatDay(period_end)}»;
  - enlace «Ver evidencia» según `rule_key`:
    - `sales_drop` → `/sales?periodo=prev_month&orden=cambio_baja`
    - `margin_drop`, `negative_margin_products`, `low_cost_coverage` → `/margin?periodo=prev_month&orden=margen_pct_asc`
    - `stale_inventory` → `/inventory?filtro=sin_movimiento`
    - `high_risk_customers` → `/receivables?riesgo=alto`
    - `receivables_concentration` → `/receivables?orden=saldo`
    - `overdue_share` → `/receivables?orden=vencido`

    (Los enlaces de ventas y margen usan `prev_month` porque las reglas evalúan el mes cerrado: el enlace muestra exactamente las cifras del hallazgo mientras siga siendo el mes siguiente.)
  - los formularios de estado.
- Navegación: «Diagnóstico» después de «Inicio», con el número de nuevos cuando sea > 0 («Diagnóstico 3»; el número va dentro del texto del enlace para que el lector de pantalla lo lea). Actualiza `organization-navigation.test.tsx`.

## Bloque en Inicio
En `src/app/(app)/o/[slug]/page.tsx`, debajo de las cifras principales: sección «Diagnóstico» con los 3 insights `new` de mayor gravedad (título, etiqueta de gravedad y «Ver evidencia») y el enlace «Ver diagnóstico». Si no hay nuevos, la sección no aparece. Obtén los datos en `getDashboard` (una consulta más en el mismo `Promise.all`).

## Estados
- Organización sin datos importados: el estado vacío de `EmptyImport`.
- Con datos pero sin insights en el estado elegido: «Nada en {estado}». En `nuevos`, además: «Los hallazgos se recalculan cada vez que importas datos.»
- Error de consulta: `role="alert"` con cómo reintentar. Error al cambiar de estado: mensaje junto al insight (`role="alert"`).
- `loading.tsx` con la misma retícula.
- Móvil (390 px): sin desbordamiento; los formularios de estado se apilan.

## Tests
- Vitest: esquema de `searchParams`; orden por gravedad y fecha (función pura); mapa de enlaces de evidencia (las 8 reglas y una desconocida, que no muestra enlace); formato del periodo (mes completo frente a corte); Server Action (Zod rechaza un id o estado inválido, `requireRole` antes del RPC, error del RPC devuelto como dato). Usa un doble del cliente.
- **E2E `e2e/insights.spec.ts`** (fixtures de `e2e/fixtures.ts`, reutiliza `importCsv`):
  1. El owner importa clientes y cuentas por cobrar con un saldo a más de 90 días (como `e2e/receivables.spec.ts`). Espera a que aparezca el insight (recarga con `expect.poll`), ve «Crítico» y «clientes con riesgo alto», sigue «Ver evidencia» y llega a Cobranza filtrada por riesgo alto. Vuelve, pulsa «Hecho» y el insight pasa a «Hechos». Inicio muestra el bloque mientras estaba nuevo.
  2. Viewer de `e2e-members`: inserta antes un insight en esa organización con `adminClient()`; el viewer lo ve sin formularios de estado.
  - Añade `/o/${slug}/insights` al test de vistas principales (CSP y desbordamiento).

## Reglas
- Server Components salvo lo imprescindible. Sin librerías nuevas. Sin tarjetas, sombras, gradientes ni kicker. Contraste AA en claro y oscuro. Foco visible en los enlaces y los botones.
- Nada de aritmética de dinero en TS: las cifras ya vienen redactadas en `title` y `body`.
- Acentos: antes de terminar, `git diff | grep -nP "[A-Za-z]\?[a-z]"` sin coincidencias.
- `typecheck`, `lint`, `test`, `build` y `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`. E2E, Lighthouse y capturas los corre Claude Code.
