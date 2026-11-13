# F2-00 · Quitar la dependencia `sonner`

Brief para Codex. Límites de entorno: `docs/tasks/F1-01-scaffold.md`. Shell PowerShell 5.1: `npm.cmd`/`npx.cmd`, sin `&&`. No corras `supabase`, `test:e2e` ni `lhci` (D-027). Escribe los archivos en UTF-8 sin BOM.

## Contexto
F1-05d eliminó el provider de Sonner porque nadie llama a `toast`. Quedan restos: la dependencia `sonner` en `package.json`, `src/components/ui/sonner.tsx`, `next-themes` (solo lo usaba ese componente; compruébalo), el hash `SONNER_STYLE_HASH` en `src/lib/csp.ts` y `src/lib/csp.test.ts`, que lee `node_modules/sonner/dist/index.mjs` para verificar ese hash.

## Entregable
- `npm.cmd uninstall sonner` (y `next-themes` si no tiene otro uso). `package-lock.json` actualizado.
- Borra `src/components/ui/sonner.tsx`. Quita el hash de Sonner de `style-src` en `createCsp` y el test que lo comprobaba; conserva el resto de `csp.test.ts`.
- `typecheck`, `lint`, `test` y `build` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos tocados · dependencias quitadas · comprobaciones.
