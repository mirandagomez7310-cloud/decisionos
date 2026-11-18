# F5-05 · Informe semanal por correo (fase 5b, corte 2)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee antes: D-031 y D-032, `supabase/migrations/20261120000000_deliveries.sql` y `20261119000000_insights.sql`, `src/lib/server/jobs/handlers/alerts.ts` (patrón de envío idempotente; síguelo), `src/lib/server/mail/` (adaptador y plantilla de alertas), `src/lib/server/metrics/period.ts`, `src/lib/format.ts`, `e2e/alerts.spec.ts` y `src/app/api/jobs/run/route.ts`.

Objetivo: cada lunes, owner y admin reciben un resumen de la semana anterior: las cifras clave y los hallazgos nuevos, con enlace a DecisionOS. Un informe por semana y destinatario, nunca dos.

## Semana del informe
La semana cubierta son los 7 días que terminan ayer en México: `to = todayInMexico - 1`, `from = to - 6`, frente a los 7 días anteriores (`prev_from`, `prev_to`). Calcúlalo en `src/lib/server/metrics/period.ts` con una función pura `resolveWeek(today)` y su test (cambio de mes y de año). El lunes, la semana es de lunes a domingo; si el job corre otro día, cubre igualmente los 7 días que terminan ayer.

## SQL (nueva migración `supabase/migrations/20261121000000_weekly_reports.sql`)
- `enqueue_weekly_reports() returns integer`: `security definer`, `search_path = ''`, solo `service_role`. Encola un `weekly_report` por organización con ventas, inventario o cuentas por cobrar, sin duplicar uno `queued` o `running` (índice único parcial como `send_alerts`). Se agenda los lunes al salir a producción (fase 7), junto a `enqueue_daily_insights`.
- pgTAP en `supabase/tests/deliveries.test.sql` (o un archivo nuevo): encola uno por organización con datos, no duplica y `authenticated` recibe `42501`.

## Contenido (`src/lib/server/mail/templates.ts`, función pura `weeklyReportEmail`)
- Asunto: «DecisionOS · Resumen semanal de {organización} ({formatPeriod(from, to)})», sin saltos de línea.
- Cifras clave, solo de los datos que la organización tiene, todas del SQL y solo formateadas:
  - ventas netas de la semana y su variación frente a la anterior (`metrics_summary` con la semana), y el margen % si hay costos;
  - inventario sin movimiento: valor y parte del total (`inventory_summary` al `to`), si hay inventario;
  - cobranza vencida: importe y porcentaje (`receivables_summary` al `to`), si hay cuentas.
- Hallazgos: los insights creados entre `from` y `to` (cualquier gravedad, no descartados), ordenados con `sortInsights`, con gravedad, `title` y `body`. Si no hay: «Sin hallazgos nuevos esta semana.».
- Enlaces absolutos a `/o/{slug}` y `/o/{slug}/insights` con `APP_URL`.
- HTML mínimo con **todo** valor escapado (reutiliza `escapeHtml`; expórtalo si hace falta) y texto plano equivalente.

## Job `weekly_report` (`src/lib/server/jobs/handlers/weekly-report.ts`)
- Destinatarios con `alert_recipients`. `dedupe_key = 'weekly:' || from || ':' || user_id`, `kind = 'weekly_report'`, `insight_id` nulo.
- Mismo patrón que `handleSendAlerts`: `upsert` de la fila `pending`, envío, `sent` o `failed` con `attempts + 1`; `mail-disabled` deja `pending`; un fallo con un destinatario no detiene a los demás; no reenvía a quien ya tiene `sent` esa semana; no reintenta un `failed` con 3 intentos.
- Audita `reports.sent` con conteos.
- `runPendingJobs`: añade `weekly_report`.
- Si `alerts.ts` y `weekly-report.ts` repiten el bloque de enviar y marcar entregas, extráelo a una función compartida en `src/lib/server/jobs/deliveries.ts` y usa la misma en los dos (los tests de alertas siguen pasando).

## Tests
- Vitest: `resolveWeek`; `weeklyReportEmail` (con y sin cada tipo de dato, sin hallazgos, escape HTML, asunto con salto de línea, enlaces absolutos); handler con un doble del cliente (no reenvía con `sent`, `mail-disabled` deja `pending`, un fallo no detiene a otro, audita).
- **E2E `e2e/weekly-report.spec.ts`**: el owner importa cuentas por cobrar con saldo vencido (como `e2e/alerts.spec.ts`). Después, con `adminClient()`, llama a `enqueue_weekly_reports` y ejecuta los jobs con `POST /api/jobs/run` y `Authorization: Bearer {JOBS_SECRET}` (léelo de `process.env` en el test). Comprueba en Mailpit **un** correo «Resumen semanal» para ese owner con la cobranza vencida y el enlace a `/insights`. Vuelve a encolar y ejecutar: sigue habiendo uno. Borra sus mensajes de Mailpit al terminar.

## Reglas
- Sin librerías nuevas. Nada de aritmética de dinero en TS. Nunca registres direcciones ni contenido en `console`; en la auditoría, solo conteos.
- Acentos: antes de terminar, `git diff | grep -nP "[A-Za-z]\?[a-z]"` sin coincidencias.
- `typecheck`, `lint`, `test`, `build` y `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`. pgTAP, E2E y la prueba con Mailpit los corre Claude Code.
