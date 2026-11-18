# F6-03 · Advisor: sección «Recomendaciones» en Diagnóstico (fase 6, corte 3)

Brief para Codex. Límites: `docs/tasks/F1-01-scaffold.md`; sin `supabase`, `test:e2e` ni `lhci` (D-027). UTF-8 sin BOM. Lee antes: D-002 y D-033, `supabase/migrations/20261122000000_advisor.sql` (`request_advisor`, `advisor_usage`, `advisor_runs`), `src/lib/server/advisor/facts.ts`, `src/lib/server/jobs/index.ts` (`runPendingJobs`), `src/features/imports/actions.ts` (patrón de `after(runPendingJobs)`), `src/features/insights/*` y `src/app/(app)/o/[slug]/insights/page.tsx`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/surfaces/src-app-app-o-slug-page-tsx.md` y `e2e/insights.spec.ts`. Este Next.js tiene cambios incompatibles con lo que conoces: consulta `node_modules/next/dist/docs/` si dudas de una API (Server Actions, `after`, `router.refresh`). No copies texto del contrato visual en el código.

Pregunta que responde: **¿qué hago primero y por qué?** Las recomendaciones citan siempre los hechos en que se apoyan, y sus cifras vienen de los datos.

## Server Action `requestAdvice` (`src/features/insights/advisor-actions.ts`, `'use server'`)
1. Zod (`slug`) → `requireRole(slug, 'owner', 'admin', 'analyst')`, **fuera** de cualquier `try` (como `setInsightStatus`).
2. Con el cliente de usuario: `loadAdvisorFacts`; sin hechos devuelve `{ status: 'no_facts' }`.
3. `advisorInputHash(facts)` → RPC `request_advisor(p_organization_id, p_input_hash)`.
4. Si el resultado es `queued`: `after(runPendingJobs)`. Después, `revalidatePath` de Diagnóstico.
5. Devuelve el resultado como dato (`queued`, `running`, `cached`, `limit`, `no_facts`, `disabled` o `error`). Nunca lanza al cliente.
- Si `AI_DRIVER` no está definido, devuelve `disabled` sin llamar al RPC.

## Datos (`src/features/insights/queries.ts`)
- `getAdvisor(slug)`, para cualquier rol:
  - `enabled` (`!!env.AI_DRIVER`);
  - la última ejecución de la organización (`advisor_runs`, `order created_at desc limit 1`);
  - `advisor_usage` (`used`, `daily_limit`);
  - las recomendaciones: insights `generated_by = 'llm'` con `status in ('new', 'seen')`, ordenados por `evidence.priority` (de 1 a 5) y fecha;
  - para cada cita, el `title` y el `status` del hecho citado (una consulta con `.in('id', ids)`).
- La lista principal de Diagnóstico pasa a mostrar solo `generated_by = 'rule'`. Las recomendaciones tienen su propia sección, sin duplicarse.

## Sección «Recomendaciones» (arriba de la lista de hallazgos, en `/o/[slug]/insights`)
- Encabezado «Recomendaciones» con la etiqueta «Generado por IA» (texto y borde neutro, no solo color) y una línea: «Hipótesis y sugerencias redactadas a partir de los hallazgos. Las cifras salen de tus datos».
- **Botón «Pedir recomendaciones»** (solo owner, admin y analyst), con «{restantes} de {límite} consultas disponibles hoy». Estados:
  - deshabilitado y con explicación si no hay hechos («Primero importa datos para tener hallazgos»), si se agotó el límite («Has usado las consultas de hoy») o si `enabled` es falso («Las recomendaciones no están activas en este entorno»);
  - mientras la última ejecución está `queued` o `running`: «Generando recomendaciones…» con `role="status"` y un componente cliente pequeño que llama a `router.refresh()` cada 3 s, durante 2 minutos como máximo;
  - resultado `cached`: «Tus hallazgos no han cambiado desde la última consulta; no se gastó ninguna consulta»;
  - última ejecución `failed`: mensaje en `role="alert"` según `error` (`refusal`, `max_tokens`, `api_error`, `invalid_output`, `no_valid_items`, `no_facts`, `disabled`), en lenguaje llano y sin detalles técnicos.
- **Lista** (`<ol>`, sin tarjetas): cada recomendación es un `<article id="insight-{id}">` con:
  - la etiqueta del tipo («Hipótesis» o «Sugerencia»);
  - la prioridad como texto («Prioridad alta» si es 1–2, «media» si es 3, «baja» si es 4–5);
  - `title` como `<h3>` y `body`;
  - «Se apoya en:» con enlaces a cada hecho citado (`/o/{slug}/insights?estado={estado del hecho}#insight-{id}`);
  - los mismos formularios de estado que los hallazgos (`StatusForm`), solo para quien puede cambiarlos.
- Los `<article>` de los hallazgos de la lista principal llevan `id="insight-{id}"` para que funcionen los enlaces.
- Sin recomendaciones ni ejecuciones: solo el botón y la línea de explicación.
- Móvil (390 px) sin desbordamiento. Contraste AA en claro y oscuro y foco visible.

## Tests
- Vitest: Server Action (Zod; `requireRole` antes de todo y fuera del `try`; `no_facts`; `disabled` sin RPC; `queued` programa `after`; error del RPC como dato); orden por prioridad; texto de la prioridad; mensaje por cada `error`; cálculo de las consultas restantes.
- **E2E `e2e/advisor.spec.ts`** (con `AI_DRIVER=fake`, que ya fijan `verify.ps1` y el CI):
  1. El owner importa clientes y cuentas por cobrar con saldo a más de 90 días (como `e2e/insights.spec.ts`) y espera a que aparezcan los hallazgos. En Diagnóstico pulsa «Pedir recomendaciones»; con `expect.poll` y recargas espera la recomendación: etiqueta «Generado por IA», enlace «Se apoya en» que lleva al hallazgo, y una cifra con formato `$` o `%` en el texto. Las consultas disponibles bajan en uno.
  2. Vuelve a pulsar: aparece el mensaje de caché y las consultas disponibles no cambian.
  3. Viewer de `e2e-members`: ve la sección sin el botón (inserta antes una ejecución y una recomendación con `adminClient()`, con un título único por ejecución, como en `insights.spec.ts`).
  - La ruta ya está en el test de vistas principales; comprueba que sigue pasando.

## Reglas
- Server Components, salvo el refresco y los formularios que ya existen. Sin librerías nuevas. Sin tarjetas, sombras, gradientes ni kicker.
- Acentos: antes de terminar, `git diff | grep -nP "[A-Za-z]\?[a-z]"` sin coincidencias.
- `typecheck`, `lint`, `test`, `build` y `playwright test --list` en verde. `git status --short` en el informe.

## Informe final (en español, breve)
Archivos · decisiones · qué comprobaste · `git status --short`. E2E, Lighthouse y capturas los corre Claude Code.
