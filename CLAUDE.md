# DecisionOS

SaaS B2B de inteligencia empresarial para distribuidoras y mayoristas en México. Fase actual: **0 · Fundación** (solo documentación; sin código ni dependencias). Ver `docs/ROADMAP.md`.

## Documentación (leer antes de tocar el área)
`docs/PRODUCT_BRIEF.md` (qué es y qué no) · `docs/ARCHITECTURE.md` (capas, stack, multi-tenant, riesgos) · `docs/DATABASE_SCHEMA.md` (tablas, RLS, migraciones) · `docs/DESIGN_SYSTEM.md` (principios visuales; los tokens irán en `DESIGN.md`) · `docs/ROADMAP.md` (fases) · `docs/DECISIONS.md` (ADR: aceptadas, propuestas, pendientes).

## Stack (propuesto, D-006 a D-012)
Next.js 16 App Router · TypeScript strict · Supabase (Postgres + Auth + Storage) · shadcn/ui + Tailwind · TanStack Table v9 · react-hook-form + Zod 4 · Vitest · Playwright · pgTAP · oxlint · Node 24 · npm. Scaffold en la fase 1 con `/nuevo-proyecto app-gestion decisionos` (antes, apartar este `CLAUDE.md`: `create-next-app` no lo admite en la carpeta destino; después añadir `@AGENTS.md` como primera línea).

## Comandos
Ninguno hasta la fase 1. Entonces: `dev`, `build`, `typecheck`, `lint`, `test`, `test:db`, `test:e2e`, `db:types`, `lhci` (nombres que `/validar` espera).

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
