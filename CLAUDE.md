@AGENTS.md

# DecisionOS

SaaS B2B de inteligencia empresarial para distribuidoras y mayoristas en México. Fase actual: **1 · Esqueleto y tenants** (scaffold hecho; migración `0001_core`, CI y auth en curso). Ver `docs/ROADMAP.md`.

## Documentación (leer antes de tocar el área)
`docs/PRODUCT_BRIEF.md` (qué es y qué no) · `docs/ARCHITECTURE.md` (capas, stack, multi-tenant, riesgos) · `docs/DATABASE_SCHEMA.md` (tablas, RLS, migraciones) · `docs/DESIGN_SYSTEM.md` (principios visuales; los tokens irán en `DESIGN.md`) · `docs/ROADMAP.md` (fases) · `docs/DECISIONS.md` (ADR: aceptadas, propuestas, pendientes).

## Stack (D-006 a D-012, aceptadas en D-021)
Next.js 16 App Router · TypeScript strict · Supabase (Postgres + Auth + Storage) · shadcn/ui (radix-nova) + Tailwind 4 · TanStack Table v9 · react-hook-form + Zod 4 · Vitest 5 · Playwright · pgTAP · oxlint · Node 24 · npm.

## Comandos
`npm run dev | build | typecheck | lint | format | test | test:db | test:e2e | db:types | lhci`. En PowerShell 5.1, `npm.cmd`/`npx.cmd`. Sin Docker local: `test:db` y `test:e2e` solo en CI.

## Flujo de trabajo (D-023)
Claude Code decide, escribe briefs en `docs/tasks/`, revisa y hace commits; Codex (sandbox `workspace-write`, red activada, cachés en `TEMP`) ejecuta cada brief. Codex no puede escribir en `.git` ni en `AppData`, y `create-next-app` o `supabase init` fallan en su sandbox: esos pasos los ejecuta Claude Code.

## Reglas propias del proyecto
- Toda tabla nueva = migración + `organization_id` + RLS + políticas + test pgTAP con denegación cruzada entre organizaciones, en la misma migración.
- Referencias entre tablas de tenant con FK compuesta `(organization_id, id)`. Políticas con `organization_id in (select public.my_org_ids())`, nunca una función que reciba la columna. Vistas siempre `with (security_invoker = true)`. Storage con políticas por prefijo `<organization_id>/`.
- Server Action o Route Handler = Zod + `requireRole(orgId, …)`; errores como datos, nunca lanzados al cliente.
- Cálculos financieros solo en SQL o en `src/lib/server/metrics/` (TS puro con tests). El LLM lee cifras calculadas; un insight `fact` nunca lo genera el LLM.
- Dinero `numeric`, nunca `float`; formato `es-MX` en UI.
- Camino con clave de servicio (jobs, importaciones): `organization_id` explícito y entrada en `audit_log`.
- Sin Docker en local: pgTAP y E2E corren en CI; no dar por válida una migración sin `test:db` en verde.
- Paneles y gráficas: leer la skill `dataviz` antes de la primera gráfica. `/security-review` en cada fase con código.
- Actualizar `docs/DECISIONS.md` con cada decisión N2 y `docs/DATABASE_SCHEMA.md` con cada migración.

Nota Obsidian: `01 Proyectos/DecisionOS.md`.
