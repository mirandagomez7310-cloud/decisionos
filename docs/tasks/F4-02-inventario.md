# F4-02 · Pantalla Inventario (fase 4, corte 2)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee antes: `docs/tasks/F3-04-ventas-margen.md` (esta pantalla sigue sus mismos patrones), `src/features/analysis/` (página, consultas, esquemas, carga, tests), `supabase/migrations/20261118000000_inventory_cash_metrics.sql`, D-030 en `docs/DECISIONS.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/surfaces/src-app-app-o-slug-page-tsx.md` (mundo «Piso de almacén»), `src/lib/format.ts`, `src/components/organization-navigation.tsx` y `e2e/analysis.spec.ts` con `e2e/fixtures.ts`. No copies texto del contrato visual en el código.

Pregunta que responde: **¿qué inventario me inmoviliza capital?** Primero el valor parado (sin movimiento) y los días de inventario, después el detalle por producto.

## Sin SQL nuevo
`inventory_summary` e `inventory_by_product` ya devuelven todo. Ordena, filtra y pagina **en el servidor** con PostgREST (`.order()`, `.ilike()`, `.eq()`, `.range()`, `count: 'exact'`), como F3-04. Si algo no se puede expresar así, detente y dilo en el informe.

## Reutiliza, no dupliques
Escape de `ilike`, cabecera, línea de resumen, tabla con scroll propio y primera columna fija, paginación, enlaces de orden con `aria-sort`, estados de error y de carga: ya existen en `src/features/analysis/`. Extrae a componentes o funciones compartidas lo que necesites; no metas condiciones de inventario dentro de `AnalysisPage`. El módulo nuevo vive en `src/features/inventory/`. Los tests de Ventas y Margen deben seguir pasando sin cambios de comportamiento.

## Datos (`src/features/inventory/queries.ts`, `server-only`)
- `requireRole(slug, …todos los roles)` y cliente de usuario (`createClient`, aplica RLS).
- Fecha de corte `p_as_of = todayInMexico(new Date())`.
- `schemas.ts` (Zod desde `@/lib/zod`) para `searchParams`: `filtro` (`todos` | `sin_movimiento`, por defecto `todos`), `orden` (abajo), `q` (1–80 caracteres, recortado, opcional), `pagina` (entero ≥ 1, por defecto 1). Inválidos: `role="alert"` con «Restablecer consulta».
- `orden`: `valor` (por defecto: `inventory_value desc`), `dias` (`days_on_hand desc`), `sin_venta` (`days_since_sale desc`, nunca vendidos primero: `nullsFirst: true`), `nombre` (`name asc`). Nulos al final en todo lo demás. Desempate por `product_id`.
- 50 filas por página.

## Pantalla (`/o/[slug]/inventory`)
- Cabecera: título «Inventario» y debajo «Existencias al <fecha del corte>» con `formatDay`. Sin selector de periodo. Si el corte tiene más de 7 días respecto a hoy, añade en la misma línea «· corte de hace N días» en `--risk` con texto, no solo color.
- Resumen en cifras, con el mismo estilo que las cifras del dashboard (`.dashboard-figure`; reutiliza clases): valor de inventario, días de inventario (`null` → «Sin ventas con costo en 90 días»), rotación anual («4,1 veces al año»), valor sin movimiento con su número de productos y su parte del valor total. Si la cobertura de valor es < 100 %: «Valor calculado sobre el 83 % de los productos; el resto no tiene costo» y enlace «Cómo importar costos» a `/o/[slug]/imports/new`.
- Fila de control: conmutador Todos | Sin movimiento (dos enlaces con `aria-current`), búsqueda por nombre (`<form method="get">` con etiqueta visible y campos ocultos para los demás parámetros) y orden.
- Tabla: nombre (SKU debajo en condensada), existencia (cantidad), costo unitario, valor, días de inventario, última venta (`formatDay`, «Nunca» si es nula) con los días sin venta debajo en condensada. Fila sin movimiento: etiqueta «Sin movimiento» con texto y borde (mismo patrón que «Riesgo»). Sin costo: valor y días en blanco con «Sin costo» en condensada, no `$0.00`.
- Navegación: añade «Inventario» después de «Margen» y actualiza `organization-navigation.test.tsx`.

## Estados
- Organización sin ningún snapshot: estado vacío con el mismo patrón de rol que `empty-sales.tsx` (quien puede importar ve el enlace a importar inventario; el resto, a quién pedírselo). Generaliza el componente si hace falta, sin cambiar su texto para ventas.
- Snapshot sin productos con existencia > 0: «El último corte no tiene existencias».
- Búsqueda sin resultados, `pagina` mayor que la última, error de consulta y móvil a 390 px: igual que F3-04.
- `loading.tsx` con la misma retícula.

## Tests
- Vitest: esquema de `searchParams` (por defecto, inválidos, `pagina` 0 y negativa), orden con `nullsFirst` correcto en `sin_venta` y en los demás (doble del cliente, como en `analysis.test.ts`), cálculo de «corte de hace N días» (función pura en `src/lib/server/metrics/`, con test de 0, 7 y 8 días).
- **E2E `e2e/inventory.spec.ts`** (reutiliza los fixtures de `e2e/fixtures.ts`):
  1. Importa por el asistente un CSV de productos con costo estándar en uno solo, un CSV de inventario con 3 productos y uno con cantidad 0, y uno de ventas donde un producto vendió hace 10 días. Comprueba: valor de inventario exacto (calculado en centavos enteros desde los CSV), el producto sin ventas con «Sin movimiento» y «Nunca», el producto sin costo con «Sin costo», y que el filtro Sin movimiento lo acota.
  2. Organización sin inventario: estado vacío.
  3. Viewer de `e2e-members` abre la pantalla sin error.
  - Añade `/o/${slug}/inventory` al test de vistas principales (CSP y desbordamiento).

## Reglas
- Server Components; sin JS de cliente nuevo. Sin librerías nuevas ni gráficas en este corte.
- Sin tarjetas, sombras, gradientes ni kicker. Contraste AA en claro y oscuro. Foco visible.
- Nada de aritmética de dinero en TS: las cifras vienen del SQL (la parte del valor total es `stale_share_pct` del resumen).
- Acentos: antes de terminar, `git diff | grep -nP "[A-Za-z]\?[a-z]"` sin coincidencias.
- `typecheck`, `lint`, `test`, `build`, `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`. E2E, Lighthouse y capturas los corre Claude Code.
