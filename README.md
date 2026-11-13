# DecisionOS

SaaS B2B de inteligencia de negocio y apoyo a decisiones para distribuidoras y mayoristas en México. Responde al propietario dónde pierde dinero, qué productos son rentables, qué inventario inmoviliza capital y qué clientes son riesgo, separando hechos, hipótesis y sugerencias, cada uno con su evidencia. No es un ERP.

**Estado:** fase 1 cerrada (esqueleto multi-tenant: registro, organizaciones, miembros, invitaciones y auditoría). Fases siguientes en [docs/ROADMAP.md](docs/ROADMAP.md).

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript strict · Supabase (Postgres con RLS, Auth) · Tailwind 4 + shadcn/ui · Zod 4 · Vitest · Playwright · pgTAP · Lighthouse CI · GitHub Actions.

## Cómo está hecho

- **Multi-tenant por esquema compartido.** Toda tabla lleva `organization_id`; las políticas RLS leen `memberships` en cada consulta (no claims del JWT), así una revocación surte efecto al instante. Claves foráneas compuestas `(organization_id, id)` para que ninguna referencia cruce tenants.
- **Roles por organización** (`owner`, `admin`, `analyst`, `viewer`) aplicados en la base y en cada Server Action con `requireRole`.
- **Invitaciones por enlace de un solo uso**: solo se persiste el hash; el enlace se muestra una vez.
- **Auditoría insert-only** (`audit_log`) con actor no suplantable, verificado en pgTAP.
- **CSP estricta con nonce** por petición, sin `unsafe-inline` ni `unsafe-eval`, y un E2E que falla ante cualquier violación.
- **Cálculos financieros solo en SQL o TypeScript puro con tests**; el LLM (fase 6) leerá cifras ya calculadas.

Las decisiones y sus alternativas están en [docs/DECISIONS.md](docs/DECISIONS.md); arquitectura y esquema en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md).

## Calidad

| Qué | Cómo |
| --- | --- |
| Aislamiento entre organizaciones | 155 aserciones pgTAP con denegación cruzada por tabla |
| Flujos de usuario | 21 E2E Playwright (escritorio y móvil): login, organización, invitación, roles, revocación, CSP |
| Lógica | Vitest (acciones, esquemas, token, CSP) |
| Rendimiento | Lighthouse CI con presupuestos (TBT ≤ 200 ms, LCP ≤ 2,5 s) en CI |

## Correr en local

Requiere Node 24, npm y Docker Desktop (para la pila local de Supabase).

```powershell
npm.cmd ci
npx.cmd supabase start            # Postgres + Auth locales; aplica las migraciones
npx.cmd supabase status -o env    # copia API_URL, PUBLISHABLE_KEY y SECRET_KEY a .env.local
npm.cmd run dev                   # http://localhost:3000
```

Las tres variables se documentan en [.env.example](.env.example). Para la secuencia completa de verificación (pgTAP, build, E2E y Lighthouse): `powershell -NoProfile -File scripts/verify.ps1`.

## Scripts

`dev` · `build` · `start` · `typecheck` · `lint` · `format` · `test` · `test:db` (pgTAP) · `test:e2e` (Playwright, requiere `build`) · `db:types` · `lhci`.

## Flujo de trabajo

Cada corte nace como brief en [docs/tasks/](docs/tasks/); un agente de código lo ejecuta y otro lo revisa, verifica (`scripts/verify.ps1`, CI) y hace los commits. El CI corre typecheck, lint, unitarios, pgTAP, build, E2E y Lighthouse en cada PR.
