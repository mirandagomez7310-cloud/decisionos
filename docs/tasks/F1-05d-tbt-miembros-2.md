# F1-05d · Miembros: bajar el TBT por debajo de 200 ms en CI

Brief para Codex. Límites de entorno: `docs/tasks/F1-01-scaffold.md`. No toques `supabase/`, `CLAUDE.md`, `.claude/` ni `scripts/`. Shell PowerShell 5.1: `npm.cmd`/`npx.cmd`, sin `&&`. No corras `supabase`, `test:e2e` ni `lhci`: desde tu sandbox no funcionan (D-027); los corre Claude Code con `scripts/verify.ps1` al recibir tu entrega.

## Hecho verificado en CI (2026-11-12, run 43297422049, commit 1cb2e9f)
pgTAP y 21 E2E en verde. Lighthouse falla solo en `/o/e2e-members/settings/members`: `total-blocking-time` 274,5 ms (presupuesto 200; antes de F1-05b 319). `/o/e2e-members` pasa. En local (Windows, CPU rápida) la misma ruta da 55 ms: el runner de CI es 4–5× más lento, así que el objetivo es recortar JS de cliente e hidratación, no afinar milisegundos. El presupuesto no se cambia.

## Lo que sigue cargando en cliente en esa ruta (compruébalo)
- `src/features/members/components/member-controls.tsx`: isla por fila con `react-hook-form`, `Button`, `RoleSelect` (Radix `Select`), diálogo de confirmación y acciones. Una tabla de N miembros hidrata N formularios.
- `src/features/invitations/components/invitations-panel.tsx`: cliente completo (formulario de invitación, lista, enlace copiable).
- `src/components/ui/{dialog,dropdown-menu,select,sonner}.tsx` (Radix + Sonner) entran por lo anterior.
- Chunks más grandes de `.next/static/chunks`: 383 KB, 229 KB, 134 KB, 109 KB, 100 KB. Identifica a qué ruta pertenece cada uno (`.next/server/app/o/[slug]/settings/members/page_client-reference-manifest.js` o el build manifest).

## Dirección
1. Controles por fila sin `react-hook-form`: `<form action={changeMemberRole}>` con los campos como inputs (hidden + select) y `useActionState` solo si hace falta mostrar el error inline; validación Zod ya está en la Server Action. Un único componente cliente pequeño por fila o, mejor, uno por tabla.
2. Cambio de rol con el `Select` nativo estilizado (ya hay clases en `components/ui`) en lugar de Radix `Select`, si eso quita el chunk de Radix de la ruta. Mantén nombre accesible, teclado y foco visible.
3. Confirmación de "quitar": `next/dynamic` del `Dialog` solo al pulsar, o un paso de confirmación en servidor (`?confirm=<user_id>`) sin JS.
4. `InvitationsPanel`: lista e historial como Server Component; cliente solo el formulario de crear y el botón de copiar enlace (un `onClick` con `navigator.clipboard`).
5. Mantén los selectores que usan los E2E (`e2e/members.spec.ts`: `getByRole`, `getByLabel`, textos de alertas). Si cambias uno, ajusta el spec con cuidado y explica por qué.

## Entregable
- Código con `typecheck`, `lint`, `test`, `build` y `npx.cmd playwright test --list` en verde.
- Antes/después del JS de cliente de `/o/[slug]/settings/members` y de `/o/[slug]` en KB (suma de chunks referenciados por la ruta), en el informe.

## Informe final (en español, breve)
Causa real de lo que quedaba · archivos modificados · KB antes/después · comprobaciones · `git status --short`.
