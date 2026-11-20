# F7-02 · Driver de correo Resend y tareas programadas (fase 7a, corte 2)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee antes: D-010, D-032, `src/env.ts`, `src/lib/server/mail/` completo, `src/lib/server/jobs/deliveries.ts`, `handlers/alerts.ts`, `handlers/weekly-report.ts` y sus tests, `src/app/api/jobs/run/route.ts` y su test, `src/lib/server/jobs/index.ts`, `vitest.config.ts`, `.github/workflows/ci.yml`, `scripts/verify.ps1`, `.env.example` y `e2e/weekly-report.spec.ts`.

**Este corte no hace ninguna llamada real a Resend.** Los tests simulan `fetch`.

Contexto verificado en las docs (2026-11-19):
- **Resend:** `POST https://api.resend.com/emails` con las cabeceras `Authorization: Bearer <clave>`, `Content-Type: application/json` e `Idempotency-Key` (opcional, hasta 256 caracteres, válida 24 h). El cuerpo lleva `{ from, to: [..], subject, html, text }` y la respuesta, `{ id }`.
- **Vercel Schedules**, que sustituye a los Cron Jobs (ahora legacy): un target `path` recibe un POST con `Authorization: Bearer <CRON_SECRET>` y la cabecera `ce-vssschedulename` con el nombre de la tarea. La entrega es at-least-once, sin reintentos. En Hobby, como mucho una ejecución cada 15 min, con 15 min de jitter.

## 1. Secreto único: `JOBS_SECRET` → `CRON_SECRET`
- Renómbralo en `src/env.ts` (`z.string().min(16)`), en la ruta y su test, en `vitest.config.ts`, `ci.yml` (`CRON_SECRET=ci-cron-secret-decisionos`), `verify.ps1` (`$env:CRON_SECRET`), `.env.example` y `e2e/weekly-report.spec.ts`. Luego `grep -rn JOBS_SECRET` fuera de `docs/tasks` y `node_modules`, sin coincidencias.

## 2. Ruta `src/app/api/jobs/run/route.ts`
- Mantén la comparación en tiempo constante y el 401.
- Después de autorizar, lee `request.headers.get('ce-vssschedulename')`:
  - `daily-insights` → `rpc('enqueue_daily_insights')` con el cliente de servicio que ya usan los jobs;
  - `weekly-reports` → `rpc('enqueue_weekly_reports')`;
  - `null` o `jobs-sweep` → nada más;
  - cualquier otro valor → 400, sin ejecutar nada.
- Si el RPC devuelve error, responde 500 sin detalles y regístralo con el nombre de la tarea, nunca con el secreto. Si todo va bien, `await runPendingJobs()` y responde 204.
- Tests: 401; 400 con nombre desconocido; cada tarea llama a su RPC y luego a `runPendingJobs`; sin cabecera solo `runPendingJobs`; error del RPC → 500 sin `runPendingJobs`.

## 3. `vercel.json` (nuevo)
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "schedules": {
    "daily-insights": { "schedule": "0 6 * * *", "timezone": "America/Mexico_City", "path": "/api/jobs/run" },
    "weekly-reports": { "schedule": "0 7 * * 1", "timezone": "America/Mexico_City", "path": "/api/jobs/run" },
    "jobs-sweep": { "schedule": "*/30 * * * *", "timezone": "America/Mexico_City", "path": "/api/jobs/run" }
  }
}
```

## 4. Driver `resend` (`src/lib/server/mail/index.ts`)
- `env.ts`:
  - `MAIL_DRIVER: z.enum(['mailpit', 'resend']).optional()`;
  - `RESEND_API_KEY: z.string().min(1).optional()`;
  - con `superRefine`, si el driver es `resend` y falta la clave, se lanza un error de validación al arrancar con el mensaje «RESEND_API_KEY es obligatoria con MAIL_DRIVER=resend».
- `sendMail` acepta un `idempotencyKey?: string` opcional. `deliveries.ts` le pasa `${organization_id}:${dedupe_key}`, recortado a 256 caracteres.
- Separa los drivers dentro del módulo:
  - `mailpit` sigue igual;
  - `resend` hace un `fetch` a `https://api.resend.com/emails` con `from: env.MAIL_FROM`, `to: [to]`, `subject` (sin saltos de línea), `html`, `text`, más la `Idempotency-Key` si existe y `AbortSignal.timeout(10_000)`.
- Respuestas de `resend`: `{ ok: true }`, `resend-http-<status>` o `resend-network-error`. Nunca registres la clave ni el cuerpo.
- Tests con `fetch` simulado: URL, método y cabeceras (incluida la idempotencia); 2xx; 429 → `resend-http-429`; error de red; destinatario inválido (sin llamar a `fetch`); `env` con `resend` sin clave falla al validar.
- `.env.example`: añade `# MAIL_DRIVER=resend` y `# RESEND_API_KEY=`, con un comentario de que `resend` envía correo real.

## Reglas
- Sin dependencias nuevas: no instales `resend` ni `@vercel/schedules`.
- Acentos: antes de terminar, `git diff | grep -nP "[A-Za-z]\?[a-z]"` sin coincidencias.
- `typecheck`, `lint`, `test`, `build` y `node node_modules/@playwright/test/cli.js test --list` en verde. Pon `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`.
