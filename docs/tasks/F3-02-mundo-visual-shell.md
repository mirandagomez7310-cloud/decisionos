# F3-02 · Mundo visual «Piso de almacén» y shell de la app (fase 3, corte 2)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee antes: `.impeccable/surfaces/src-app-app-o-slug-page-tsx.md` (contrato de dirección), `.impeccable/mocks/decision/assigned.html` (boceto elegido, referencia de composición), `PRODUCT.md`, `docs/DESIGN_SYSTEM.md`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/o/[slug]/layout.tsx`. No copies texto del contrato en el código ni en comentarios.

## Entregables
1. **Tokens en `src/app/globals.css`** (sustituyen los grises por defecto de shadcn; mantén los nombres que usa shadcn para que sus componentes hereden):
   - Claro: fondo concreto `#E7E5DF`; superficie elevada (inputs, menús) `#F3F2EE`; tinta `#1A1D21`; tinta secundaria derivada de la tinta (no gris neutro) con contraste ≥ 4.5:1 sobre el fondo; montante/borde `#1D3F66` al 30 %; shell (barra superior) `#1D3F66` con texto `#FFFFFF`; acción `#F2C230` con texto `#1A1D21`; riesgo `#D9531E` (texto de riesgo sobre fondo claro con ≥ 4.5:1, oscurece si hace falta); serie actual `#2E5E9E`; serie anterior `#8A877F`.
   - Oscuro (por `prefers-color-scheme: dark`, sin interruptor ni librería): fondo azul de rack profundo `#0F1E30` (nunca negro); superficie `#16283D`; tinta `#E9ECEF`; shell `#0A1624`; acción `#F2C230`; riesgo con ≥ 4.5:1 sobre el fondo oscuro; serie actual `#5F8FD6`; serie anterior `#58606C`. Ajusta el `@custom-variant dark` para que siga la preferencia del sistema.
   - Tokens con nombre propio para el mundo: `--shell`, `--shell-foreground`, `--action`, `--action-foreground`, `--risk`, `--upright` (montante), `--series-current`, `--series-previous`, `--tag-code` (bloque amarillo de la etiqueta), `--tag-paper` (etiqueta blanca `#FFFFFF` en claro, `#1C2F45` en oscuro).
   - Radio: `--radius` 2px (esquinas de etiqueta, casi rectas).
   - Superficies del navegador tematizadas: `::selection` (amarillo de acción con tinta), `caret-color`, `accent-color`, anillo de foco visible de 2px en acción con separación de 2px, `text-underline-offset`, barras de desplazamiento finas en tinta del mundo, `font-variant-numeric: tabular-nums` en `td`, `th` y en una utilidad `.figure`.
2. **Tipo**: `next/font/google` con **Barlow** (400, 500, 600, 700) como `--font-sans` y **Barlow Condensed** (500, 600) como `--font-condensed`; quita Geist. Utilidad o clase para rótulos condensados en mayúsculas con tracking ligero.
3. **Shell** en `src/app/(app)/layout.tsx` y `src/app/(app)/o/[slug]/layout.tsx`:
   - Barra superior a todo el ancho en `--shell`: «DecisionOS» (wordmark en Barlow 700, sin logo inventado), navegación de la organización (Inicio, Ventas, Margen, Importaciones, Catálogo; Miembros y Auditoría solo owner/admin, como hoy), y a la derecha correo y «Cerrar sesión». Enlace activo marcado con subrayado de 2px en acción y `aria-current="page"`.
   - Ventas y Margen enlazan a `/o/[slug]/sales` y `/o/[slug]/margin`; crea esas dos páginas con un título y «Disponible pronto» (las llena F3-04).
   - Fuera de una organización (crear organización, invitaciones) la barra lleva solo wordmark, correo y salir.
   - Móvil (390 px): sin desbordamiento horizontal de página; la navegación salta de línea o es una franja propia con `overflow-x: auto`; objetivos táctiles ≥ 44 px. El test de vistas principales de `e2e/members.spec.ts` ya comprueba el desbordamiento: debe seguir en verde.
   - Contenido en `main` con ancho máximo cómodo para pantallas de trabajo (unos 1280 px) y márgenes de 16 px en móvil y 40 px en escritorio.
   - Enlace «Saltar al contenido» visible al enfocar.
4. **Pantallas existentes heredan el mundo** sin rediseñarlas: tablas de importaciones, catálogo, miembros y auditoría con cabecera en condensada, filas separadas por montantes finos, cifras a la derecha; botones primarios en acción; sin tarjetas ni sombras nuevas. Los textos y la funcionalidad no cambian.

## Reglas
- Nada de gradientes, sombras decorativas, glassmorphism, `border-left` de color, emoji como iconos, kicker sobre los títulos ni tarjetas anidadas.
- Contraste AA comprobado en claro y oscuro para tinta, tinta secundaria, texto en shell, texto en acción y riesgo; anota los ratios en el informe.
- `typecheck`, `lint`, `test`, `build`, `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · ratios de contraste · qué comprobaste · `git status --short`. E2E y capturas los hace Claude Code.
