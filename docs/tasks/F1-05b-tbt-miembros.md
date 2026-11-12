# F1-05b · Reducir el bloqueo del hilo principal en la página de miembros

Brief para Codex. Límites de entorno: `docs/tasks/F1-01-scaffold.md`. No toques `supabase/`, `CLAUDE.md`, `.claude/`, ni los módulos aprobados de F1-04 salvo lo indicado.

## Hecho verificado en CI (2026-11-12, run 43139051676)
pgTAP y los 21 E2E pasan. Lighthouse (móvil emulado, 3 runs) falla solo en `/o/e2e-members/settings/members`: `total-blocking-time` 319 ms, presupuesto 200 ms. `/o/e2e-members` pasa. El presupuesto no se cambia: es el proxy de laboratorio del INP.

## Diagnóstico de partida (compruébalo, no lo des por cierto)
1. `src/app/providers.tsx` es cliente e importa `zod` completo solo para `z.config({ jitless: true })`: eso mete Zod en el bundle de **todas** las páginas. Alternativa: ejecutar `z.config` únicamente en los módulos cliente que usan Zod (los formularios con `zodResolver`), o usar `zod/mini` en los esquemas que lleguen al cliente, o no usar `zodResolver` en cliente y validar solo en la Server Action (la UI muestra `fieldErrors`).
2. La página de miembros carga en cliente tabla TanStack v9, `react-hook-form`, `Select`, `Dialog`, `DropdownMenu` y Sonner a la vez. Mide con `npx.cmd next build` (si imprime tamaños) o con `ANALYZE`/inspección de `.next/static/chunks` qué pesa cada ruta; alternativas: tabla renderizada en servidor (los miembros ya vienen ordenados y paginados del servidor; TanStack en cliente no aporta nada aquí) y `next/dynamic` para `Dialog`/`Select` solo cuando se abren.
3. Hidratación: menos componentes cliente. Lo que no reacciona a eventos debe ser Server Component.

## Entregable
- Cambios mínimos que bajen el JS de cliente de esa ruta; tabla de miembros como Server Component salvo los controles (cambiar rol, quitar) que sean islas pequeñas. Mantén accesibilidad, estados y los selectores que usan los E2E (`e2e/members.spec.ts`): si cambias un `getByRole`/`getByLabel`, ajusta el spec con cuidado.
- Antes/después del tamaño de JS de `/o/[slug]/settings/members` y de `/` (en KB, de `.next` o del build) en el informe.
- `typecheck`, `lint`, `test`, `build` y `playwright test --list` en verde.

## Informe final (en español, breve)
Causa real encontrada · archivos modificados · tamaños antes/después · comprobaciones · `git status --short`.
