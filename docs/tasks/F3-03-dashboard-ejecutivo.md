# F3-03 · Executive Dashboard (fase 3, corte 3)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee antes: `.impeccable/surfaces/src-app-app-o-slug-page-tsx.md` (contrato), `.impeccable/mocks/decision/assigned.html` (composición que hay que igualar), `docs/DESIGN_SYSTEM.md`, `supabase/migrations/20261114000000_metrics.sql`, `src/lib/server/metrics/period.ts`, los tokens de `src/app/globals.css` (F3-02) y `src/app/(app)/o/[slug]/page.tsx`. No copies texto del contrato en el código.

## Antes: ajustes del shell (revisión de F3-02)
- **Móvil (390 px)**: la barra superior ocupa hoy unos 255 px. Déjala en ≤ 112 px: una fila con wordmark y menú de cuenta (`<details>` nativo con el correo y «Cerrar sesión», objetivo táctil ≥ 44 px) y debajo la navegación en una sola franja con `overflow-x: auto` (sin salto de línea; el enlace activo visible). Escritorio sin cambios.
- «Nueva importación» (lista de importaciones) es la acción principal de esa pantalla: botón en `--action`, no enlace de texto.
- **Acentos**: escribe todo archivo en UTF-8 real. Antes de terminar ejecuta `git diff | grep -nP "[A-Za-z]\?[a-z]"` y corrige cualquier palabra con `?` en lugar de tilde (en F3-02 llegaron «Cat?logo», «Auditor?a»).

## Datos
- `src/features/dashboard/queries.ts`: con el cliente de usuario (`createClient`, aplica RLS) y tras `requireRole(slug, …todos los roles)`, llama a `metrics_summary`, `metrics_daily_sales` (actual y anterior) y `metrics_by_product` / `metrics_by_customer`. De los desgloses pide en servidor los 2 que más suben (`order delta desc`, `delta > 0`) y los 2 que más bajan (`order delta asc`, `delta < 0`), con `.limit()`. Saber si la organización tiene alguna venta (`sales` con `head: true, count: 'exact'`, `.limit(1)`).
- Periodo desde `?periodo=` con `periodSchema` y `resolvePeriod(…, todayInMexico(new Date()))`. Etiquetas de periodo en `es-MX`: «1–13 nov 2026 vs. 1–13 oct 2026».
- Formato en `src/lib/format.ts` (con tests): moneda `es-MX` MXN con 2 decimales, porcentaje con 1 decimal y espacio fino antes de `%`, puntos («−1.8 pts»), signo menos tipográfico `−` y `+` explícito en variaciones. Solo formatea: nada de aritmética de dinero en TS.

## Pantalla (`src/app/(app)/o/[slug]/page.tsx`)
- Cabecera: título «Resumen ejecutivo», periodo legible debajo; a la derecha el selector de periodo (Mes en curso vs. anterior · Últimos 30 días · Mes anterior completo) como `<select>` nativo en acción, componente cliente mínimo que navega con `?periodo=` al cambiar (con `<noscript>` no hace falta).
- Dos columnas iguales separadas por un montante (una columna en móvil, ventas primero):
  - **Etiqueta de ubicación** (componente `LocationTag`): etiqueta de papel con bloque de código en `--tag-code` (`VTA · NOV`, `MGN · NOV`; mes del periodo en mayúsculas condensadas), nombre de la cifra y periodo a la derecha.
  - **Cifra de cartel** (`.figure`, unos 88 px en escritorio y 48 px en móvil, `clamp()`), alineada a la derecha; nunca se corta ni desborda con `$999,999,999.99` en 390 px.
  - Variación (`+12.3 %` / `−1.8 pts`) y comparación («frente a $1,143,820.00»), en tinta, nunca solo en color.
  - Línea de estado en condensada con el vocabulario fijo: «Completa», «Cobertura: 83 % del importe con costo», «Sin datos de costo», «Sin comparación» (anterior en 0).
  - Margen: cifra en pesos y `· 31.0 %` a su lado; si la cobertura es 0 o nula, la cifra se sustituye por «Sin datos de costo» con enlace a cómo importar costos (a `/o/[slug]/imports/new`).
- **Curva diaria** a todo el ancho del contenido, unos 240 px de alto (`src/components/charts/line-chart.tsx`, SVG propio, D-016): serie actual en `--series-current` línea continua de 2px; anterior en `--series-previous` discontinua; eje Y con 3–4 marcas en `es-MX` abreviado («$80 mil»), eje X por día; rejilla recesiva; marcador ≥ 8px en el último punto actual. Leyenda siempre visible con el periodo de cada serie y etiqueta directa al final de cada línea. **Capa de hover** cliente (`line-chart-hover.tsx`): cruz vertical y tooltip con día y las dos cifras exactas en moneda; también por teclado (foco en el gráfico y flechas). Debajo, `<details>` «Ver tabla» con la tabla equivalente (día, actual, anterior). `role="img"` con `aria-label` resumen en el SVG. Sin animación de dibujo.
- **«Qué explica el cambio»**: dos tablas (Productos que más mueven la venta · Clientes), columnas: nombre, cambio en venta, margen % (solo productos). Cifras a la derecha, cabeceras en condensada, filas separadas por montantes finos. Margen negativo: celda en `--risk` con etiqueta «Riesgo» con borde de 1px (texto + borde, no solo color). Si no hay movimientos: «Sin cambios entre los dos periodos».
- **Estados**:
  - `loading.tsx`: esqueleto con la misma retícula (no spinner).
  - Organización sin ninguna venta: estado vacío propio, «Aún no hay datos», qué importar (ventas en CSV o Excel con folio, fecha, cliente, producto, cantidad y precio; costo opcional para el margen) y botón «Importar ventas» (solo owner/admin; analyst y viewer ven a quién pedírselo).
  - Periodo sin ventas con historial: cifras en `$0.00` con estado «Sin ventas en el periodo».
  - Error de consulta: mensaje con `role="alert"` y cómo reintentar.
- Pie discreto: «Importes en MXN · Ventas completadas; canceladas y devueltas excluidas».
- **Movimiento distintivo**: al cambiar de periodo, el texto de las etiquetas y cifras se re-rotula en su sitio (transición corta de opacidad/clip ≤ 180 ms con ease-out), sin mover columnas; nada con `prefers-reduced-motion: reduce`.

## Tests
- Vitest: `format.ts`; el componente de gráfico renderiza la tabla equivalente y el `aria-label`.
- **E2E `e2e/dashboard.spec.ts`**:
  1. Cifras cuadradas contra el archivo origen: crea con `adminClient()` una organización nueva y un owner nuevo (no uses la organización compartida `e2e-members`), genera un CSV con 6 líneas de venta fechadas en el mes en curso (fecha calculada con `todayInMexico`) y 3 en el mes anterior en el mismo tramo de días, con costo en algunas líneas; impórtalo por la interfaz (asistente) y confirma. Calcula los totales esperados en el test **en centavos enteros** a partir del CSV y comprueba que el dashboard muestra exactamente la venta neta, el margen, la cobertura y la variación esperados.
  2. Organización sin ventas: se ve «Aún no hay datos» y el botón de importar (owner).
  3. Viewer de `e2e-members` ve el dashboard y no ve el botón de importar.
  - Añade `/o/${slug}` a la lista del test de vistas principales si no está (CSP y desbordamiento).

## Reglas
- Sin tarjetas, sombras, gradientes, kicker sobre títulos ni sparklines decorativas. Contraste AA en claro y oscuro.
- `typecheck`, `lint`, `test`, `build`, `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`. E2E, Lighthouse y capturas los corre Claude Code.
