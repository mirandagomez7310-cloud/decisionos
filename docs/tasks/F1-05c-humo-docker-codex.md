# F1-05c · Prueba de humo: Docker y Supabase local desde el sandbox de Codex

Brief para Codex. Límites de entorno: `docs/tasks/F1-01-scaffold.md`. No modifiques código ni `supabase/`; solo ejecuta y reporta. Shell PowerShell 5.1: `npm.cmd`/`npx.cmd`, sin `&&`.

## Contexto
Docker Desktop 29 ya está instalado y la pila local de Supabase está arrancada (`npx.cmd supabase start` lo hizo Claude Code). Queremos saber si desde tu sandbox puedes operar Docker y la base local, para que a partir de ahora ejecutes tú `test:db`, `build`, `test:e2e` y `lhci` antes de entregar.

## Pasos (anota el resultado exacto de cada uno, incluido el error si falla)
1. `docker ps --format "{{.Names}} {{.Status}}"` (debe listar contenedores `supabase_*_decisionos`).
2. `npx.cmd supabase status -o env` (no copies las claves al informe; di solo qué variables aparecen).
3. Exporta en la shell `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` con los valores de `API_URL`, `PUBLISHABLE_KEY` y `SECRET_KEY` de ese comando (`.env.local` ya los tiene; no lo edites).
4. `npm.cmd run test:db` (esperado: 155 aserciones, PASS).
5. `npm.cmd run build`.
6. `$env:PLAYWRIGHT_BROWSERS_PATH = (Join-Path $env:TEMP 'decisionos-playwright')` y luego `npm.cmd run test:e2e` (esperado: 21 passed).
7. `npm.cmd run lhci` (reporta perf y `total-blocking-time` por URL).
8. `npx.cmd supabase stop` y después `npx.cmd supabase start`: comprueba si puedes parar y arrancar la pila desde tu sandbox. Si `start` falla, dilo y deja la pila como quede.

## Informe final (en español, breve)
Tabla paso → ok/falla → detalle de una línea · qué NO puedes hacer desde el sandbox (Docker, red, rutas) · `git status --short` (debe estar limpio salvo `playwright-report/`, `test-results/`, `.lighthouseci/`, que están ignorados).
