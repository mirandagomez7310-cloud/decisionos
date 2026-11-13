# F2-07 · Endurecimientos de cierre de fase 2

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee `supabase/migrations/20261112020000_core.sql` (políticas de `memberships` y `audit_log`), `src/lib/server/imports/parse.ts` y `supabase/tests/{memberships_rls,audit_log_rls}.test.sql`.

## Hechos comprobados por Claude Code
- Ningún código de `src/` ni `e2e/` inserta en `public.memberships` con el cliente de usuario: las altas pasan por `create_organization` y `accept_invitation` (`security definer`). El grant `insert` y la política `memberships_insert` para `authenticated` sobran.
- Las únicas acciones que la app escribe en `audit_log` con el cliente de usuario son `imports.<evento>`, `invitations.created`, `invitations.revoked`, `members.removed` y `members.role_changed`. Hoy la política acepta cualquier `action` que no empiece por `membership.`, `organization.` ni `invitation.`.
- `parseFile` limita el `.xlsx` a 25 MiB comprimidos, pero `read-excel-file` descomprime con `fflate` en memoria sin tope: un zip de 25 MiB puede expandirse a varios GiB (bomba de descompresión) y tumbar la función.
- `npm audit`: 15 avisos, todos en dependencias de desarrollo. Los de `@lhci/cli` y `shadcn` solo se arreglan degradando versión mayor (no aceptable); `minimatch` y `ts-morph` sí tienen arreglo compatible.

## Entregables
1. **Migración `supabase/migrations/20261113030000_hardening.sql`** (no edites las anteriores):
   - `drop policy memberships_insert on public.memberships; revoke insert on public.memberships from authenticated;`.
   - Sustituye `audit_log_insert` por una política igual pero con `action ~ '^(imports|invitations|members)\.[a-z_]+$'` en vez de los tres `not like`.
2. **pgTAP**: en `memberships_rls.test.sql`, las aserciones «gestor inserta miembro» y «owner crea segundo owner» pasan a `throws_ok` `42501` (ajusta las que dependían de esa fila insertada). En `audit_log_rls.test.sql`, los `insert` de prueba usan `members.test`; añade que `authenticated` recibe `42501` con `action = 'role.1'`, `'membership.added'` y `'imports.'` (sin evento). Actualiza los `plan()`.
3. **Bomba de descompresión** en `parse.ts`: antes de `readSheet`, lee el directorio central del zip (registro *End of Central Directory*, firma `0x06054b50`, buscado desde el final; entradas con firma `0x02014b50`, tamaño descomprimido en el offset 24) y suma los tamaños descomprimidos. Si la suma supera **200 MiB** o el archivo no tiene directorio central válido, lanza `Error('El archivo .xlsx es demasiado grande al descomprimir')`. Sin dependencias nuevas; función pura `zipUncompressedSize(buffer): number` en `src/lib/server/imports/zip.ts` con tests en `zip.test.ts` (zip construido en el test con `node:zlib` + cabeceras a mano o con una fixture pequeña generada: una entrada normal pasa; una cuyo tamaño declarado sea 300 MiB se rechaza; un buffer sin EOCD se rechaza). Añade un test en `parse.test.ts` que compruebe el mensaje de error con el buffer manipulado.
4. **`npm audit fix`** sin `--force`. Si cambia `package-lock.json`, deja `typecheck`, `lint`, `test` y `build` en verde; indica en el informe qué avisos quedan y por qué (versión mayor).
5. `docs/DATABASE_SCHEMA.md`: política de `audit_log` y nota de que `memberships` solo se inserta por RPC. `docs/DECISIONS.md`: añade D-029 aceptada: «Los avisos de `npm audit` en dependencias de desarrollo cuyo arreglo exige degradar versión mayor (`@lhci/cli`, `shadcn`) se aceptan y se revisan en cada fase».

## Reglas
- `typecheck`, `lint`, `test`, `build`, `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · avisos de `npm audit` restantes · `git status --short`. pgTAP lo corre Claude Code.
