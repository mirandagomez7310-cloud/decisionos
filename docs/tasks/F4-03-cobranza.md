# F4-03 · Pantalla Cobranza (fase 4, corte 3)

Brief para Codex. Va **después de F4-02** y reutiliza las piezas compartidas que extrajo. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee antes: `docs/tasks/F4-02-inventario.md` y lo que entregó en `src/features/inventory/`, `supabase/migrations/20261118000000_inventory_cash_metrics.sql`, D-030 en `docs/DECISIONS.md`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/surfaces/src-app-app-o-slug-page-tsx.md`, `src/lib/format.ts`, `src/components/organization-navigation.tsx` y `e2e/fixtures.ts`. No copies texto del contrato visual en el código.

Pregunta que responde: **¿quién me debe, cuánto está vencido y qué clientes son riesgo?**

## Sin SQL nuevo
`receivables_summary` y `receivables_by_customer` ya devuelven todo. Ordena, filtra y pagina **en el servidor** con PostgREST, como F4-02. Si algo no se puede expresar así, detente y dilo en el informe.

## Datos (`src/features/receivables/queries.ts`, `server-only`)
- `requireRole(slug, …todos los roles)`, cliente de usuario, `p_as_of = todayInMexico(new Date())`.
- `schemas.ts` para `searchParams`: `riesgo` (`todos` | `alto` | `medio` | `bajo`, por defecto `todos`), `orden` (abajo), `q` (1–80, recortado, opcional; busca en `name`), `pagina` (≥ 1, por defecto 1). Inválidos: `role="alert"` con «Restablecer consulta».
- `orden`: `vencido` (por defecto: `overdue_balance desc`), `saldo` (`open_balance desc`), `dias` (`max_days_overdue desc`), `credito` (`credit_used_pct desc`, nulos al final), `nombre` (`name asc`). Desempate por `customer_id`.
- 50 filas por página.

## Pantalla (`/o/[slug]/receivables`)
- Cabecera: título «Cobranza» y debajo «Saldos al <hoy>» con `formatDay`. Sin selector de periodo.
- Resumen en cifras (mismo estilo que el dashboard): saldo por cobrar, vencido con su porcentaje, concentración «Los 5 clientes con más saldo deben el 62 %».
- **Antigüedad**: una fila de cinco cifras con su etiqueta (Por vencer · 1–30 · 31–60 · 61–90 · Más de 90), en tinta; «Más de 90» en `--risk` si es > 0, con texto. Es una tabla (`<table>` de una fila con `<th scope="col">`), no una gráfica.
- Fila de control: conmutador Todos | Alto | Medio | Bajo (enlaces con `aria-current`, cada uno con su número entre paréntesis del total filtrado por búsqueda: tres `count: 'exact'` con `head: true`), búsqueda y orden.
- Tabla: nombre (código debajo en condensada), saldo, vencido, más de 90 días, días máximos de vencimiento («Al corriente» si es 0), uso de crédito («Sin límite» si es nulo; > 100 % en `--risk`), participación %, riesgo. Riesgo como etiqueta con texto y borde: «Alto» con el patrón de «Riesgo», «Medio» con borde neutro, «Bajo» sin etiqueta (texto «Bajo» en `--muted`).
- Navegación: añade «Cobranza» después de «Inventario» y actualiza `organization-navigation.test.tsx`.

## Estados
- Organización sin cuentas por cobrar importadas: estado vacío con el componente generalizado en F4-02 (enlace a importar cuentas por cobrar según rol).
- Cuentas importadas pero todo pagado: «No hay saldos pendientes».
- Búsqueda sin resultados, `pagina` mayor que la última, error de consulta, móvil a 390 px y `loading.tsx`: igual que F4-02.

## Tests
- Vitest: esquema de `searchParams`, filtro de riesgo y orden con nulos al final (doble del cliente).
- **E2E `e2e/receivables.spec.ts`** (fixtures de `e2e/fixtures.ts`):
  1. Importa por el asistente clientes (uno con límite de crédito bajo) y un CSV de cuentas por cobrar con una pagada del todo, una parcial, una vencida a más de 90 días y una por vencer. Comprueba: saldo total exacto (centavos enteros desde el CSV), que la pagada no aparece, «Alto» en el cliente a más de 90 días y en el que supera su límite, y que el filtro Alto los acota.
  2. Organización sin cuentas: estado vacío.
  3. Viewer de `e2e-members` abre la pantalla sin error.
  - Añade `/o/${slug}/receivables` al test de vistas principales (CSP y desbordamiento).

## Reglas
- Server Components; sin JS de cliente nuevo. Sin librerías nuevas ni gráficas.
- Sin tarjetas, sombras, gradientes ni kicker. Contraste AA en claro y oscuro. Foco visible.
- Nada de aritmética de dinero en TS: todas las cifras y porcentajes vienen del SQL.
- Acentos: antes de terminar, `git diff | grep -nP "[A-Za-z]\?[a-z]"` sin coincidencias.
- `typecheck`, `lint`, `test`, `build`, `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`. E2E, Lighthouse y capturas los corre Claude Code.
