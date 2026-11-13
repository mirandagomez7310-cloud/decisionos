@AGENTS.md

# DecisionOS

SaaS B2B de inteligencia empresarial para distribuidoras y mayoristas en México. Fase actual: **1 · Esqueleto y tenants** (scaffold hecho; migración `0001_core`, CI y auth en curso). Ver `docs/ROADMAP.md`.

## Documentación (leer antes de tocar el área)
`docs/PRODUCT_BRIEF.md` (qué es y qué no) · `docs/ARCHITECTURE.md` (capas, stack, multi-tenant, riesgos) · `docs/DATABASE_SCHEMA.md` (tablas, RLS, migraciones) · `docs/DESIGN_SYSTEM.md` (principios visuales; los tokens irán en `DESIGN.md`) · `docs/ROADMAP.md` (fases) · `docs/DECISIONS.md` (ADR: aceptadas, propuestas, pendientes).

## Stack (D-006 a D-012, aceptadas en D-021)
Next.js 16 App Router · TypeScript strict · Supabase (Postgres + Auth + Storage) · shadcn/ui (radix-nova) + Tailwind 4 · TanStack Table v9 · react-hook-form + Zod 4 · Vitest 5 · Playwright · pgTAP · oxlint · Node 24 · npm.

## Comandos
`npm run dev | build | typecheck | lint | format | test | test:db | test:e2e | db:types | lhci`. En PowerShell 5.1, `npm.cmd`/`npx.cmd`. Con Docker Desktop: `npx supabase start`, `.env.local` con las claves de `supabase status -o env` (API_URL, PUBLISHABLE_KEY, SECRET_KEY) y exportadas en la shell para `test:e2e` y `lhci`; `test:e2e` necesita `build` previo (usa `next start`). Desde Git Bash, `npx playwright` falla por el espacio de `Program Files`: `node node_modules/@playwright/test/cli.js test`.

## Flujo de trabajo (D-023)
Claude Code decide, escribe briefs en `docs/tasks/`, revisa, corre `powershell -NoProfile -File scripts/verify.ps1` (pila Supabase, pgTAP, build, E2E, Lighthouse) y hace commits y pushes; Codex (sandbox `workspace-write`, red activada, cachés en `TEMP`) ejecuta cada brief y deja `typecheck`, `lint`, `test` y `build` en verde. Codex no puede escribir en `.git` ni en `AppData`, ni usar Docker ni el CLI de Supabase (D-027): esos pasos los ejecuta Claude Code.

## Reglas propias del proyecto
- Toda tabla nueva = migración + `organization_id` + RLS + políticas + test pgTAP con denegación cruzada entre organizaciones, en la misma migración.
- Referencias entre tablas de tenant con FK compuesta `(organization_id, id)`. Políticas con `organization_id in (select public.my_org_ids())`, nunca una función que reciba la columna. Vistas siempre `with (security_invoker = true)`. Storage con políticas por prefijo `<organization_id>/`.
- Server Action o Route Handler = Zod + `requireRole(orgId, …)`; errores como datos, nunca lanzados al cliente. `z` siempre desde `@/lib/zod` (activa `jitless` antes de construir esquemas; si no, la CSP reporta el sondeo de `new Function` de Zod 4).
- Cálculos financieros solo en SQL o en `src/lib/server/metrics/` (TS puro con tests). El LLM lee cifras calculadas; un insight `fact` nunca lo genera el LLM.
- Dinero `numeric`, nunca `float`; formato `es-MX` en UI.
- Camino con clave de servicio (jobs, importaciones): `organization_id` explícito y entrada en `audit_log`.
- No dar por válida una migración sin `test:db` en verde (local o CI). Las cifras de Lighthouse en Windows son orientativas; valen las de CI.
- Paneles y gráficas: leer la skill `dataviz` antes de la primera gráfica. `/security-review` en cada fase con código.
- Actualizar `docs/DECISIONS.md` con cada decisión N2 y `docs/DATABASE_SCHEMA.md` con cada migración.

Nota Obsidian: `01 Proyectos/DecisionOS.md`.
