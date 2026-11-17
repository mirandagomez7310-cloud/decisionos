# F3-04 · Ventas y Margen (fase 3, corte 4)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee antes: `PRODUCT.md`, `DESIGN.md`, `.impeccable/surfaces/src-app-app-o-slug-page-tsx.md` (el mundo «Piso de almacén» que estas pantallas heredan), `supabase/migrations/20261114000000_metrics.sql`, `src/features/dashboard/queries.ts`, `src/app/(app)/o/[slug]/page.tsx` (tablas «Qué explica el cambio», `LocationTag`, `PeriodSelect`), `src/lib/format.ts` y `src/app/(app)/o/[slug]/settings/members/page.tsx` (patrón de `searchParams` con Zod y tabla en servidor). No copies texto del contrato en el código.

Objetivo de la fase (ROADMAP): «ventas por periodo con variación; margen por producto y cliente con cobertura». Las dos pantallas responden: **Ventas** → ¿qué productos y clientes explican que la venta suba o baje? **Margen** → ¿qué productos y clientes son rentables y cuáles me cuestan dinero?

## Sin SQL nuevo
`metrics_by_product` y `metrics_by_customer` ya devuelven por fila venta actual y anterior, `delta`, `delta_pct`, `gross_margin`, `margin_pct` y `coverage`. Ordena, filtra y pagina **en el servidor** sobre el RPC con el query builder de PostgREST (`.order()`, `.ilike()`, `.range()`, `count: 'exact'`). Si algo no se puede expresar así, detente y dilo en el informe; no añadas migraciones.

## Datos (`src/features/analysis/queries.ts`, `server-only`)
- `requireRole(slug, …todos los roles)` y cliente de usuario (`createClient`, aplica RLS), como `getDashboard`.
- `src/features/analysis/schemas.ts` (Zod desde `@/lib/zod`) para `searchParams`: `periodo` (`periodSchema`, por defecto `mtd`), `vista` (`productos` | `clientes`, por defecto `productos`), `orden` (enum por pantalla, abajo), `q` (texto recortado, 1–80 caracteres, opcional), `pagina` (entero ≥ 1, por defecto 1). Parámetros inválidos: mensaje con `role="alert"` y enlace «Restablecer consulta», como en miembros.
- Búsqueda por nombre con `.ilike('name', …)`, escapando `\`, `%` y `_` del texto del usuario (función pura con test). Solo nombre, sin `.or()`.
- 50 filas por página; total con `count: 'exact'`.
- Tipos de los RPC: amplía `src/lib/supabase/types.ts` igual que ya están `metrics_by_product` / `metrics_by_customer` (devuelven todas las columnas de la migración).

## Pantalla Ventas (`/o/[slug]/sales`)
- Cabecera como el dashboard: título «Ventas», periodo legible debajo y `PeriodSelect` a la derecha. El componente ya existe; extráelo si hace falta para que conserve el resto de parámetros (`vista`, `orden`, `q`) y reinicie `pagina`.
- Fila de control: conmutador Productos | Clientes (dos enlaces con `aria-current`, no pestañas ARIA), búsqueda (`<form method="get">` con `<input type="search">` y etiqueta visible, conserva los demás parámetros en campos ocultos) y orden.
- `orden`: `cambio_baja` (por defecto: `delta asc`, primero lo que más cae), `cambio_sube` (`delta desc`), `venta` (`net_sales desc`), `nombre` (`name asc`). Desempate siempre por id para que la paginación sea estable.
- Tabla: nombre (con SKU o código debajo en condensada), venta actual, venta anterior, cambio en pesos, cambio % («Sin comparación» si anterior = 0). Cabeceras ordenables como enlaces (`aria-sort` en la activa). Cifras a la derecha, tabulares, montantes finos; mismo estilo que las tablas del dashboard (reutiliza las clases, no las dupliques).
- Encima de la tabla, una línea de resumen en tinta: «Suben 23 · Bajan 41 · Sin cambio 3» del total filtrado (tres `count: 'exact'` con `head: true`).

## Pantalla Margen (`/o/[slug]/margin`)
- Misma cabecera, conmutador, búsqueda y paginación.
- `orden`: `margen_pct_asc` (por defecto: los menos rentables primero), `margen_pct_desc`, `margen` (`gross_margin desc`), `venta`, `nombre`. Filas sin costo (`margin_pct` nulo) **siempre al final**, en cualquier orden (`nullsFirst: false`).
- Tabla: nombre (+ SKU o código), venta, margen en pesos, margen %, cobertura. Margen negativo: celda en `--risk` con la etiqueta «Riesgo» del dashboard (texto y borde, no solo color). Cobertura < 100 %: «83 %» en condensada; 0 o nula: «Sin datos de costo» y el margen en blanco, no `$0.00`.
- Encima de la tabla: «Con pérdida 4 · Sin datos de costo 12» del total filtrado y, si hay alguno sin costo, enlace «Cómo importar costos» a `/o/[slug]/imports/new`.

## Enlaces desde el dashboard
En «Qué explica el cambio», cada nombre enlaza a la fila en su pantalla: productos a Margen y clientes a Ventas, con `vista`, `periodo` y `q` = nombre exacto.

## Estados (ambas pantallas)
- `loading.tsx` por ruta: esqueleto con la misma retícula de tabla.
- Organización sin ventas: el estado vacío del dashboard. Extráelo a un componente compartido con el mismo texto y la misma lógica de rol.
- Periodo sin ventas con historial: «Sin ventas en el periodo». Búsqueda sin resultados: «Ningún producto (o cliente) coincide con «…»» y enlace para quitar la búsqueda.
- `pagina` mayor que la última: muestra la última, sin error.
- Error de consulta: `role="alert"` con cómo reintentar.
- Móvil (390 px): la tabla no desborda la página. Usa scroll horizontal propio con la primera columna fija (`position: sticky`) y una región con `tabindex="0"` y `aria-label`; sin columnas ocultas.

## Tests
- Vitest: esquema de `searchParams` (por defecto, inválidos, `pagina` 0 y negativa, `q` con espacios), escape de `ilike`, orden con nulos al final (orden de la llamada al builder con un doble del cliente, como en `import.test.ts`).
- **E2E `e2e/analysis.spec.ts`** (reutiliza el fixture `dashboardOwner` de `e2e/dashboard.spec.ts`; muévelo a `e2e/fixtures.ts` si hace falta y deja `dashboard.spec.ts` pasando):
  1. Importa por el asistente un CSV con 3 productos en los dos periodos, uno con costo mayor que el precio y uno sin costo. En Margen comprueba el orden por defecto: la fila con pérdida primero con «Riesgo» y la sin costo al final con «Sin datos de costo». En Ventas, cambio en pesos exacto (calculado en centavos enteros desde el CSV) de un producto.
  2. Búsqueda que acota a una fila; búsqueda con `%` que no devuelve todo.
  3. Viewer de `e2e-members` abre las dos pantallas sin error.
  - Añade `/o/${slug}/sales` y `/o/${slug}/margin` al test de vistas principales (CSP y desbordamiento).

## Reglas
- Server Components; cliente solo el selector de periodo. Sin TanStack Table ni librerías nuevas.
- Sin tarjetas, sombras, gradientes ni kicker sobre títulos. Contraste AA en claro y oscuro. Foco visible en enlaces de orden y conmutador.
- Nada de aritmética de dinero en TS: las cifras vienen del SQL y solo se formatean.
- Acentos: antes de terminar, `git diff | grep -nP "[A-Za-z]\?[a-z]"` sin coincidencias.
- `typecheck`, `lint`, `test`, `build`, `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`. E2E, Lighthouse y capturas los corre Claude Code.
