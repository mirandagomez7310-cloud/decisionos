# F7-03 · Demo local y guía de producción (fase 7a, corte 3)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). No puedes ejecutar los scripts contra la base: Claude Code los probará. UTF-8 sin BOM. Lee antes: `docs/DATABASE_SCHEMA.md` (tablas de negocio, `imports`, `jobs`, `audit_log`), las migraciones de `supabase/migrations/`, `src/lib/server/imports/` (cómo se insertan ventas, existencias y cuentas por cobrar y qué columnas exigen), `src/lib/server/jobs/index.ts`, `e2e/fixtures.ts` (creación de usuario y organización con clave de servicio), `scripts/verify.ps1` y la sección de Node de `package.json` / `.nvmrc`.

## 1. `scripts/demo-seed.ts`
Se ejecuta con `node scripts/demo-seed.ts` (Node 24 quita los tipos de forma nativa, sin `tsx`). Usa solo sintaxis que el *type stripping* admita: sin `enum`, sin `namespace` y con `import type`. Importa `@supabase/supabase-js` por su nombre de paquete; nada de alias `@/`.
- Lee `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SECRET_KEY` del entorno. Si falta alguna, o si la URL no es `http://127.0.0.1` ni `http://localhost`, **aborta**: el seed no debe poder ejecutarse jamás contra una base remota.
- **Idempotente.** Si existe la organización con slug `distribuidora-demo`, bórrala; el `on delete cascade` borra lo demás (D-024). Si existe `demo@decisionos.local`, reutilízalo; si no, créalo con la contraseña `demo-decisionos-2026` y `email_confirm: true`.
- Crea la organización «Distribuidora Demo» con ese slug y al usuario como `owner`, igual que `e2e/fixtures.ts`.
- **Datos deterministas** (PRNG con semilla fija, sin `Math.random`):
  - 40 productos en 5 categorías y 25 clientes con límite de crédito.
  - Unos 6 meses de ventas hasta hoy (`America/Mexico_City`), con costo en el 90 % de las líneas.
  - Patrones visibles:
    - una categoría que cae más del 20 % en el último mes completo;
    - un producto con margen negativo;
    - cinco clientes con más del 50 % de las ventas.
  - Corte de inventario de hoy, con un 25 % del valor sin movimiento en 90 días.
  - Cuentas por cobrar con un cliente en el tramo de más de 90 días y por encima de su límite.
- **Inserción.** Usa las mismas tablas y columnas que la importación, con `organization_id` explícito y un `import` registrado si el esquema lo exige. Escribe en `audit_log` `demo.seeded` con `actor_kind = 'system'`, o lo que el esquema permita para la clave de servicio.
- **Insights.** Encola los insights con `rpc('enqueue_daily_insights')` y después `POST ${APP_URL}/api/jobs/run` con `Authorization: Bearer ${CRON_SECRET}`. Si la app no está levantada, avisa de que los insights se calcularán en cuanto arranque y llegue el siguiente barrido. No falles por eso.
- Termina imprimiendo los conteos y las credenciales de la demo.

## 2. `scripts/demo.ps1` (PowerShell 5.1)
1. Igual que `verify.ps1`: levanta `supabase start` si hace falta y lee `supabase status -o env`.
2. Escribe `.env.local` con:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` sacadas del estado;
   - `CRON_SECRET` aleatorio si no existe ya en el archivo;
   - `MAIL_DRIVER=mailpit`, `AI_DRIVER=fake` y `APP_URL=http://127.0.0.1:3000`.

   Conserva cualquier otra línea que ya tenga el archivo y escríbelo en UTF-8 sin BOM.
3. Exporta esas variables y ejecuta `node scripts/demo-seed.ts`.
4. Imprime la app (`http://127.0.0.1:3000`), Mailpit (`http://127.0.0.1:54324`), Studio (`http://127.0.0.1:54323`) y las credenciales. Después ejecuta `npm.cmd run dev`.
- No uses `supabase db reset`: borraría lo que haya creado la persona.

## 3. `docs/DEPLOY.md` (guía, en español)
Pasos en orden; cada uno marca que es N3 (los ejecuta o autoriza la persona usuaria):
1. **Supabase Free.**
   - Crear el proyecto (región más cercana a México), `npx supabase link` y `npx supabase db push`.
   - Auth → URL del sitio y Redirect URLs (`https://<dominio>/**`).
   - SMTP personalizado de Resend: `smtp.resend.com`, puerto 465, usuario `resend`, contraseña = API key.
   - Plantilla de confirmación con el contenido de `supabase/templates/confirmation.html`.
   - Activar las confirmaciones.
   - Aviso: el plan Free pausa los proyectos inactivos.
2. **Resend.** Cuenta, dominio verificado (DNS) y API key con permiso solo de envío.
3. **Vercel Hobby.**
   - Importar el repo.
   - Variables: las de `.env.example` con sus valores de producción; `CRON_SECRET` aleatorio de 32 o más caracteres; `MAIL_DRIVER=resend`; `APP_URL=https://<dominio>`; `AI_DRIVER` sin definir hasta la evaluación del Advisor.
   - Los `schedules` de `vercel.json` se aplican al desplegar.
   - Aviso: Hobby no admite uso comercial; pasar a Pro con el primer cliente (D-035).
4. **Dominio:** conectarlo en Vercel.
5. **Comprobaciones posteriores:**
   - registro con confirmación;
   - importar un CSV;
   - `vercel schedules invoke weekly-reports` y revisar el correo;
   - consola sin errores de CSP;
   - Lighthouse.
6. **Vuelta atrás:** Instant Rollback en Vercel; las migraciones solo avanzan.

## 4. Documentación del proyecto
- `docs/DECISIONS.md`. Añade al final, sin reescribir las anteriores:
  - **D-034 (Aceptada):** Vercel Schedules con targets `path` hacia `/api/jobs/run` (tareas `daily-insights`, `weekly-reports` y `jobs-sweep`), en lugar de los Cron Jobs, que ahora son legacy; `JOBS_SECRET` pasa a ser `CRON_SECRET`.
  - **D-035 (Aceptada):** Vercel Hobby y Supabase Free hasta el primer cliente que pague. Resuelve D-020 en lo que toca a la plataforma.
  - **D-036 (Aceptada):** Resend como proveedor de correo, por API para las alertas y por SMTP para Supabase Auth. Resuelve D-017.
- `docs/ROADMAP.md`: parte la fila de la fase 7 en 7a (producción), 7b (API `v1` con tokens por organización), 7c (suscripciones, D-018) y 7d (primera integración, D-014).
- `CLAUDE.md`: «Fase actual: **7a · Producción**», y añade `scripts/demo.ps1` a «Comandos».
- `README.md`: una sección «Ver la demo en local» que apunte a `scripts/demo.ps1`.

## Reglas
- No toques `supabase/seed.sql` ni los E2E.
- Acentos: antes de terminar, `git diff | grep -nP "[A-Za-z]\?[a-z]"` sin coincidencias.
- `typecheck`, `lint`, `test` y `build` en verde, y `node --check scripts/demo-seed.ts` si tu versión de Node lo admite. Pon `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · columnas y tablas que usaste para cada tipo de dato · qué no pudiste probar · `git status --short`.
