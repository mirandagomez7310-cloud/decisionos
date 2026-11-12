# F1-01 · Scaffold Next.js + tooling (fase 1, corte 1)

Brief para Codex. Lo decide y revisa Claude Code; Codex ejecuta. Contexto del producto en `docs/ARCHITECTURE.md` y reglas en `docs/DECISIONS.md` (D-006 a D-012, D-021, D-023).

## Entorno y límites (obligatorio)
- Shell: PowerShell 5.1. Usa `npm.cmd` y `npx.cmd` (nunca `npm`/`npx`: la política bloquea `npm.ps1`). Separa comandos con `;` o en llamadas distintas; `&&` no existe.
- **Nada de git que escriba** (`add`, `commit`, `stash`, `checkout`, `mv`…): `.git` está protegido y los commits los hace Claude Code. `git status`/`git diff` sí.
- No toques `docs/` salvo lo que diga este brief. `CLAUDE.md` y `.claude/` no están en la carpeta a propósito; no los crees.
- Versiones: usa las que instale npm (`latest`). Si una mayor difiere de la citada aquí, lee su documentación instalada (`node_modules/<paquete>/`, y para Next `node_modules/next/dist/docs/`) antes de configurarla. Versiones de referencia (2026-10-30): next 16.4 · react 19.3 · @supabase/ssr 0.12 · supabase CLI 3.x · shadcn 4.23 · @tanstack/react-table 9.3 · react-hook-form 7.91 · @hookform/resolvers 6 · zod 4.6 · vitest 5 · @playwright/test 1.64 · oxlint 1.90 · @lhci/cli 0.15 · Node 24.
- Código, tablas y rutas en inglés; copy de UI y comentarios en español. Comentarios solo para el porqué.
- Sin abstracciones ni opciones que este brief no pida. Mínimo código que funcione.

## Pasos
1. `npx.cmd create-next-app@latest . --ts --app --src-dir --tailwind --import-alias "@/*" --use-npm --disable-git --yes` (en la carpeta actual; `docs/` y `.git` no estorban).
   - Quita ESLint: `npm.cmd uninstall eslint eslint-config-next`, borra `eslint.config.mjs` y el script `lint`.
   - Deja el `AGENTS.md` que genera y lee `node_modules/next/dist/docs/` (al menos getting-started, caching y proxy) antes de escribir código.
   - `@types/node` a `^24` (el `^20` que trae choca con Vitest 5 / Vite 8).
2. `next.config.ts`: `cacheComponents: false` (la CSP con nonce del corte 2 es incompatible con PPR) y cabeceras `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`.
   - Layout raíz: `await headers()` (todas las rutas dinámicas, lo exigirá el nonce), `<html lang="es">`, enlace «Saltar al contenido», landmarks `header`/`main`, un `h1` por página. Página inicial mínima en español (nombre del producto y una línea), sin marketing.
3. `npx.cmd shadcn@latest init -t next -b radix -p nova --yes --no-monorepo` y `npx.cmd shadcn@latest add button input label select dialog dropdown-menu table sonner`. (En radix-nova no existe `form`.)
4. Dependencias: `npm.cmd i @supabase/ssr @supabase/supabase-js @tanstack/react-table react-hook-form @hookform/resolvers zod server-only`. Dev: `npm.cmd i -D supabase oxlint vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @playwright/test @lhci/cli prettier`. **No** instales `@vitejs/plugin-react` (Vite 8 transforma JSX con oxc; su Babel choca con el de shadcn).
5. `npx.cmd supabase init` (CLI 3.x: mira `--help` por si cambió el flag `--yes`/`--force`; no generes config de VS Code ni IntelliJ). `npx.cmd oxlint --init` y deja `.oxlintrc.json` con `"plugins": ["typescript", "unicorn", "oxc", "react", "nextjs", "jsx-a11y", "import"]`. `npx.cmd playwright install chromium`. `.nvmrc` con `24`. `.prettierrc` mínimo (`{ "semi": false, "singleQuote": true }`).
   - `.gitignore`: añade `!.env.example`, `supabase/.temp/`, `e2e/.auth/`, `test-results/`, `playwright-report/`, `.lighthouseci/`, `.sb.env`.
6. `tsconfig.json`: `"noUncheckedIndexedAccess": true`; comprueba que `strict` está activo.
7. `src/env.ts`: dos esquemas Zod (servidor y cliente `NEXT_PUBLIC_*`) y un objeto tipado; nadie lee `process.env` fuera de ese archivo. Claves: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (solo servidor). `.env.example` versionado con valores ficticios.
8. Tests: `vitest.config.ts` con `environment: 'jsdom'`, alias `@` → `src`, y `server-only` resuelto a un módulo vacío; `src/test/setup.ts` con `@testing-library/jest-dom/vitest`. Un test de `src/env.ts` que pase (esquema válido e inválido). `playwright.config.ts`: proyectos `setup` → `Desktop Chrome` y `Pixel 7`, `webServer` con `npm run build` + `npm run start` (sin tests E2E todavía; llegan en el corte de auth).
9. `package.json` scripts: `dev`, `build`, `start`, `typecheck` = `next typegen && tsc --noEmit`, `lint` = `oxlint`, `format` = `prettier --write .`, `test` = `vitest run`, `test:db` = `supabase test db`, `test:e2e` = `playwright test`, `db:types` = `supabase gen types typescript --local > src/lib/supabase/types.ts`, `lhci` = `lhci autorun`.
10. `README.md`: qué es, requisitos (Node 24), instalación, scripts, variables (remite a `.env.example`), despliegue (Vercel, pendiente).
11. Ejecuta y pega la salida literal (recortada a las últimas 30 líneas si es larga): `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`. Si algo falla por tu código, arréglalo; si falla por el entorno (red, permisos, Docker), repórtalo y sigue.

## Fuera de este corte
Supabase (clientes, `proxy.ts`, CSP, migraciones, auth), `lib/auth.ts`, data-table, formularios, CI, Vercel. Llegan en F1-02 y siguientes.

## Informe final (en español, breve)
1. Versiones instaladas: `npm.cmd ls --depth=0`.
2. Desviaciones respecto a este brief y por qué.
3. Salida de las cuatro comprobaciones del paso 11.
4. `git status --short` (solo lectura).
