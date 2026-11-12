# DecisionOS

Aplicación de información de negocio para distribuidoras. Este corte prepara Next.js, los componentes de interfaz y las herramientas; la autenticación y los módulos de negocio llegan después.

## Requisitos e instalación

Node.js 24 y npm. En PowerShell 5.1 usa `npm.cmd` y `npx.cmd`.

```powershell
$env:npm_config_cache = (Join-Path $env:TEMP 'decisionos-npm-cache')
$env:PLAYWRIGHT_BROWSERS_PATH = (Join-Path $env:TEMP 'decisionos-playwright')
npm.cmd ci
Copy-Item .env.example .env.local
npx.cmd playwright install chromium
npm.cmd run dev
```

Abre http://localhost:3000. Sustituye los valores ficticios de `.env.local` por los del proyecto de desarrollo. Las tres variables se documentan en [.env.example](.env.example). `SUPABASE_SECRET_KEY` es exclusiva del servidor; `src/env.ts` centraliza y valida las variables con Zod y está protegido con `server-only`.

## Scripts

Ejecuta `npm.cmd run <script>`:

| Script      | Función                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| `dev`       | Servidor de desarrollo                                                       |
| `build`     | Compilación de producción                                                    |
| `start`     | Servidor de producción, después de compilar                                  |
| `typecheck` | Generar tipos de rutas y comprobar TypeScript                                |
| `lint`      | Comprobar código con oxlint                                                  |
| `format`    | Formatear con Prettier                                                       |
| `test`      | Tests unitarios con Vitest                                                   |
| `test:db`   | Tests de Supabase local; requiere Docker y la pila iniciada                  |
| `test:e2e`  | Playwright; compila e inicia producción (tests pendientes del corte de auth) |
| `db:types`  | Generar tipos desde Supabase local                                           |
| `lhci`      | Lighthouse CI (configuración pendiente)                                      |

La inicialización de Supabase se ejecuta con `npx.cmd supabase init`; no se configura un editor. Las operaciones de base de datos requieren completar esa inicialización y disponer de Docker. La configuración de Playwright reserva un proyecto `setup` del que dependen Desktop Chrome y Pixel 7.

## Despliegue

Vercel, pendiente de un corte posterior. Este scaffold no configura CI ni recursos remotos.
