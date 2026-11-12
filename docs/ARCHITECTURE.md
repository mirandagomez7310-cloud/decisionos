# DecisionOS — Arquitectura

Estado: fundación (fase 0). Lo marcado **[Propuesta]** es una decisión N2 pendiente de aprobación; el detalle está en `DECISIONS.md`.

## 1. Principios

1. **Monolito modular.** Una sola aplicación Next.js con un módulo por dominio (`features/<módulo>`). Se extrae un servicio solo cuando un módulo lo exija por carga o aislamiento; hoy ninguno lo exige.
2. **La base de datos es la frontera de seguridad.** Aislamiento por organización con Row Level Security (RLS) en cada tabla. La aplicación comprueba rol además, nunca en lugar de RLS.
3. **Métricas deterministas.** Todo cálculo financiero vive en SQL (vistas y funciones) o en TypeScript puro con tests. El LLM recibe cifras calculadas y devuelve texto clasificado; no opera números.
4. **Datos de entrada validados en el borde.** Zod en Server Actions, Route Handlers, importaciones y variables de entorno.
5. **Mínimo de infraestructura.** Un proveedor de base de datos y auth, un proveedor de hosting, sin colas ni workers externos hasta que una métrica real lo pida.

## 2. Stack [Propuesta]

| Capa | Elección | Por qué |
|---|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions), TypeScript `strict` | SSR para paneles con datos por sesión, una sola base de código para UI y API, plantilla `app-gestion` ya probada |
| Base de datos, auth, storage | Supabase (Postgres, Auth, Storage) | Postgres con RLS resuelve multi-tenant sin capa propia; storage para los archivos importados; migraciones y tests pgTAP con su CLI. **No se ha verificado conexión con Supabase en esta sesión** |
| UI | shadcn/ui (Radix) + Tailwind | Componentes accesibles sin estética impuesta; la identidad la fija `DESIGN_SYSTEM.md` |
| Tablas | TanStack Table v9 | Orden, filtro y paginación en servidor con estado en URL |
| Formularios | react-hook-form + Zod (mismo esquema cliente/servidor) | Plantilla |
| Gráficas | Pendiente (se elige en la fase del Executive Dashboard con la skill `dataviz`) | No añadir hasta tener datos reales en pantalla |
| Importación | `papaparse` (CSV) y `read-excel-file` (.xlsx, solo lectura) | `xlsx` en npm está congelado en 0.18.5 con dos avisos de severidad alta sin corrección en npm (verificado con `npm audit` el 2026-11-11) |
| Procesamiento asíncrono | Tabla `jobs` en Postgres; la Server Action que crea el job dispara el worker (Route Handler) en la misma petición con `after()`, y un cron solo barre los jobs que quedaron `queued`; reclamo con `FOR UPDATE SKIP LOCKED` | Cero infraestructura nueva. El cron no puede ser el disparador: en el plan Hobby de Vercel corre como máximo una vez al día con ±59 min de precisión; en Pro, cada minuto (docs de Vercel, 2026-11-11). Vercel marca Cron Jobs como legacy a favor de Schedules: elegir cuál en la fase 2. Subir a `pg-boss` o Vercel Queues cuando un job supere el tiempo máximo de función |
| IA | Adaptador propio en `lib/server/ai/`; proveedor y modelo **pendientes** (D-015) | Se deciden en la fase 6 consultando la documentación vigente, no de memoria; el adaptador aísla la elección |
| Hosting | Vercel | CI ya definido en la plantilla, previews por PR, cron incluido |
| Calidad | oxlint, Prettier, Vitest, Playwright, pgTAP, Lighthouse CI, GitHub Actions | Plantilla |

Versiones verificadas en npm el 2026-11-11: next 16.4.6 · react 19.3.1 · @supabase/ssr 0.12.7 · @supabase/supabase-js 2.119.0 · supabase CLI 3.1.0 (mayor nueva respecto a la plantilla: revisar cambios antes de usarla) · shadcn 4.23.0 · @tanstack/react-table 9.3.1 · zod 4.6.7 · vitest 5.1.0 · @playwright/test 1.65.0 · oxlint 1.93.0 · papaparse 5.7.1 · read-excel-file 9.3.15.

## 3. Capas

```
Navegador
  └─ app/(app)/o/[slug]/<módulo>/   Server Components + Client Components (shadcn)
       └─ features/<módulo>/        actions.ts (Server Actions) · queries.ts · schemas.ts · components/
            └─ lib/server/          auth.ts (requireRole) · metrics/ (cálculos TS puros) · ai/ · imports/ · jobs/
                 └─ Supabase        Postgres (RLS, vistas de métricas, funciones) · Auth · Storage
```

Reglas entre capas:
- Las páginas no consultan Supabase directamente: pasan por `features/<módulo>/queries.ts`.
- `lib/server/*` empieza con `import 'server-only'`.
- `lib/server/metrics/*` no importa Supabase: recibe datos, devuelve números. Así se testea con Vitest sin base de datos.
- Las Server Actions: parsear con Zod → `requireRole` → operar → devolver `{ ok, data | fieldErrors }`, nunca lanzar al cliente.

## 4. Flujo de datos

```
CSV / Excel ──▶ Storage (archivo original) ──▶ job "import" ──▶ staging (filas crudas + errores por fila)
   ──▶ tablas normalizadas (products, customers, sales, sale_lines, inventory_snapshots, receivables)
   ──▶ vistas y funciones de métricas (SQL) ──▶ job "compute_insights" ──▶ insights (hecho | hipótesis | sugerencia)
   ──▶ UI (dashboard, módulos) · alerts · reports · AI Advisor (lee insights y métricas, redacta)
```

- Cada importación guarda el archivo original, el mapeo de columnas usado y el resultado por fila. Se puede repetir y revertir (las filas normalizadas llevan `source_import_id`).
- Las métricas se calculan por organización y periodo; no se cachean en la aplicación hasta que haga falta (primero vistas `security_invoker`, que respetan RLS; luego vistas materializadas en un esquema privado tras una función que filtra por organización, si el tiempo de consulta lo justifica).
- Los insights son filas, no texto suelto: `kind` (fact, hypothesis, suggestion), `evidence` (qué métrica, qué periodo, qué filas) y `metric_snapshot` (las cifras en el momento de generarse). El AI Advisor cita insights por id.

## 5. Multi-tenant

Estrategia: **base de datos y esquema compartidos, columna `organization_id` en toda tabla de tenant, RLS por membresía.**

- `memberships(organization_id, user_id, role)` es la única fuente de pertenencia. Roles: `owner`, `admin`, `analyst`, `viewer`.
- Políticas RLS de la forma `organization_id in (select public.my_org_ids())` (y `my_org_ids_with_role(roles)` para escribir): funciones sin argumentos de fila, `security definer` con `set search_path = ''`, que **leen `memberships`**, no el JWT, y que Postgres evalúa una vez por consulta en lugar de por fila. Revocar una membresía corta el acceso en la siguiente consulta, sin esperar a que caduque el token (la plantilla documenta que un claim en el JWT tarda hasta 1 h en refrescarse).
- Las referencias entre tablas de tenant son claves foráneas compuestas `(organization_id, id)`: una venta no puede apuntar a un producto de otra organización ni por error de aplicación.
- Las rutas con clave de servicio (jobs, importaciones) saltan RLS: reciben `organization_id` explícito como parámetro, lo propagan a cada escritura y registran en `audit_log`.
- Cada tabla nueva llega con migración, RLS, políticas y un test pgTAP que incluye la **denegación cruzada**: un miembro de la organización A no lee ni escribe filas de B.
- Alternativa descartada: esquema o base por tenant. Más aislamiento, pero migraciones N veces, sin soporte directo en Supabase y sin beneficio con decenas de clientes.

## 6. Seguridad

- Auth Supabase con `@supabase/ssr`; `proxy.ts` refresca sesión y fija CSP con nonce por petición (patrón de la plantilla `app-gestion`).
- `requireRole(orgId, ...roles)` en cada página protegida y Server Action. La organización activa viaja en la URL (`/o/[slug]/…`) y se comprueba contra `memberships` en cada petición.
- `SUPABASE_SECRET_KEY` solo en servidor; nunca `NEXT_PUBLIC_`.
- Cabeceras: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, CSP estricta (ver plantilla).
- Archivos importados: un solo bucket privado `imports` con prefijo `<organization_id>/` y políticas en `storage.objects` por ese prefijo (misma regla de aislamiento que las tablas); URL firmada de corta duración; tamaño máximo y tipos permitidos validados antes de firmar.
- Las vistas de métricas se crean `with (security_invoker = true)`; sin ello una vista salta las políticas de sus tablas.
- `/security-review` en cada fase con código.

## 7. API para integraciones (futuro)

Route Handlers bajo `app/api/v1/`, autenticados con tokens por organización (tabla `api_tokens`, hash en base de datos, alcance por rol). Mismo código de dominio que las Server Actions. No se construye hasta la fase 7.

## 8. Estructura de carpetas

```
decisionos/
  CLAUDE.md · AGENTS.md (lo genera create-next-app) · README.md
  docs/                       PRODUCT_BRIEF, ARCHITECTURE, DATABASE_SCHEMA, DESIGN_SYSTEM, ROADMAP, DECISIONS
  src/
    app/
      (auth)/login/
      (app)/o/[slug]/         layout: sesión + membresía
        dashboard/ sales/ profit/ inventory/ cash/ advisor/ imports/ reports/ settings/
      api/v1/                 futuro
    features/
      dashboard/ sales/ profit/ inventory/ cash/ advisor/ imports/ reports/ admin/
        components/ · actions.ts · queries.ts · schemas.ts
    components/ui/            shadcn
    components/data-table/    tabla genérica (TanStack v9)
    components/form/          campos RHF + shadcn
    components/charts/        se crea en la fase del dashboard
    lib/supabase/             server.ts · client.ts · proxy.ts · types.ts (generado)
    lib/server/
      auth.ts                 getUser, requireRole
      metrics/                cálculos puros + tests
      imports/                parseo CSV/Excel, mapeo, validación por fila
      jobs/                   claim y ejecución de jobs
      ai/                     adaptador LLM (fase 6)
    env.ts · proxy.ts
  supabase/
    migrations/ · tests/<tabla>_rls.test.sql · seed.sql · config.toml
  e2e/
  .github/workflows/ci.yml
```

## 9. Entorno verificado (2026-11-11)

- Node 24.19.0, npm 11.17.0, git 2.55. Sin pnpm (se usa npm). Docker Desktop 29 desde 2026-11-12: `supabase start`, `supabase test db`, E2E y Lighthouse corren en local además de en CI.
- `create-next-app` 16.4.6 acepta una carpeta destino que ya contenga `docs/`, `.git`, `.gitignore`, `.claude/` o `LICENSE`, pero **no** `CLAUDE.md` ni `README.md`. Antes del scaffold hay que apartar `CLAUDE.md` y devolverlo después.
- Supabase y Context7 aparecen en esta sesión solo con herramientas de autenticación: no se ha comprobado que estén conectados.

## 10. Riesgos técnicos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Migración sin probar | La frontera de aislamiento (RLS) solo se garantiza con pgTAP | PR obligatorio con CI; no dar por válida una migración sin `test:db` en verde (local o CI) |
| Calidad de los datos de origen (SKU inconsistentes, clientes duplicados, costos ausentes) | Métricas incorrectas con apariencia de precisión | Staging con errores por fila, reglas de normalización explícitas, métricas que declaran cobertura ("calculado sobre el 83 % de las líneas con costo") |
| Tiempo máximo de función en Vercel para importaciones grandes | Jobs cortados a mitad | Procesar por lotes idempotentes con `jobs.progress`; medir con archivos reales antes de la fase 2 |
| Coste de RLS por fila en agregaciones sobre `sale_lines` | Dashboards lentos al crecer los datos | Políticas con `in (select my_org_ids())`, nunca función con la columna como argumento; `EXPLAIN (ANALYZE)` sobre cada vista en la fase 2 con datos reales |
| Costo y latencia del LLM | Advisor lento o caro | El LLM solo lee insights ya calculados; caché por organización y periodo; límites por plan |
| Costes de plataforma sin estimar (plan de Vercel, Supabase, LLM, correo) | Un plan Hobby limita el cron a una vez al día; un plan de pago cambia el margen por cliente | D-020: estimar con las cifras vigentes de cada proveedor antes de la fase 2, no de memoria |
| Supabase CLI 3.x es mayor nueva respecto a la plantilla | Comandos o `config.toml` cambiados | Leer el changelog de 3.0 antes de `supabase init` |
| Un solo desarrollador | Bus factor | Documentación viva en `docs/` y nota de proyecto en Obsidian |
