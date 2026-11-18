import 'server-only'

import { env } from '@/env'
import { advisorInputHash, loadAdvisorFacts } from '@/lib/server/advisor/facts'
import { renderAdvice } from '@/lib/server/advisor/render'
import { validateAdvice } from '@/lib/server/advisor/validate'
import { generateAdvice } from '@/lib/server/ai'
import { todayInMexico } from '@/lib/server/metrics/period'
import { audit, checked, type Client, type Job } from '../shared'

export async function handleAdvisor(db: Client, job: Job) {
  const organizationId = job.organization_id
  const payload = job.payload
  const runId =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload.run_id
      : null
  if (!organizationId || typeof runId !== 'string')
    throw new Error('Job sin organización o run_id válido')

  const runQuery = () =>
    db
      .from('advisor_runs')
      .select('status,input_hash,period_start')
      .eq('organization_id', organizationId)
      .eq('id', runId)
  const updateRun = (values: {
    status?: 'queued' | 'running'
    input_hash?: string
  }) =>
    db
      .from('advisor_runs')
      .update(values)
      .eq('organization_id', organizationId)
      .eq('id', runId)

  const run = await checked(runQuery().single())
  if (!run) throw new Error('Ejecución de asesoría inexistente')
  if (run.status !== 'queued') return

  const claimed = await checked(
    updateRun({ status: 'running' })
      .eq('status', 'queued')
      .select('id')
      .maybeSingle(),
  )
  if (!claimed) return

  const complete = (
    error: string | null,
    details?: {
      model: string
      usage: { input: number; output: number }
      items: number
    },
  ) =>
    checked(
      db.rpc('complete_advisor_run', {
        p_run_id: runId,
        p_status: error === null ? 'done' : 'failed',
        p_error: error,
        p_driver: env.AI_DRIVER ?? null,
        p_model: details?.model ?? null,
        p_input_tokens: details?.usage.input ?? null,
        p_output_tokens: details?.usage.output ?? null,
        p_items: details?.items ?? null,
      }),
    )

  let facts
  try {
    facts = await loadAdvisorFacts(db, organizationId)
    const input_hash = advisorInputHash(facts)
    if (input_hash !== run.input_hash)
      await checked(updateRun({ input_hash }).eq('status', 'running'))
    if (!facts.length) {
      await complete('no_facts')
      return
    }
  } catch (error) {
    // La cola puede reintentar porque aún no se ha invocado el modelo.
    await checked(updateRun({ status: 'queued' }).eq('status', 'running'))
    throw error
  }

  let failure = 'persistence_error'
  try {
    const result = await generateAdvice(facts)
    if (!result.ok) {
      failure = result.error
      await complete(failure)
      return
    }

    const { items, rejected } = validateAdvice(result.output, facts)
    if (!items.length) {
      failure = 'no_valid_items'
      await complete(failure)
      return
    }

    const period_end = todayInMexico(new Date())
    await checked(
      db.from('insights').insert(
        items.map((item) => {
          // Los hechos ya vienen ordenados por gravedad.
          const fact = facts.find(({ id }) => item.cites.includes(id))!
          return {
            organization_id: organizationId,
            generated_by: 'llm',
            kind: item.kind,
            rule_key: null,
            module: fact.module,
            severity: fact.severity,
            ...renderAdvice(item, facts),
            evidence: {
              run_id: runId,
              cites: item.cites,
              priority: item.priority,
            },
            period_start: run.period_start,
            period_end,
          }
        }),
      ),
    )
    await complete(null, { ...result, items: items.length })
    await audit(db, job, 'advisor.completed', {
      entity: 'advisor_runs',
      entityId: runId,
      data: {
        items: items.length,
        rejected,
        input_tokens: result.usage.input,
        output_tokens: result.usage.output,
      },
    })
  } catch {
    try {
      await complete(failure)
    } catch {
      console.error('No se pudo registrar el fallo de la asesoría')
    }
    console.error('Falló la persistencia de la asesoría')
  }
}
