import 'server-only'

import { describeInsight } from '@/lib/server/insights/describe'
import { todayInMexico } from '@/lib/server/metrics/period'
import { audit, checked, type Client, type Job } from '../shared'

export async function handleComputeInsights(db: Client, job: Job) {
  const organization_id = job.organization_id
  if (!organization_id) throw new Error('Job sin organización')

  const candidates = await checked(
    db.rpc('evaluate_insight_rules', {
      p_organization_id: organization_id,
      p_as_of: todayInMexico(new Date()),
    }),
  )
  if (!candidates)
    throw new Error('La evaluación de insights no devolvió datos')
  if (candidates.length) {
    await checked(
      db.from('insights').upsert(
        candidates.map((candidate) => ({
          ...candidate,
          ...describeInsight(candidate),
          organization_id,
          kind: 'fact',
          generated_by: 'rule',
          status: 'new',
        })),
        {
          onConflict: 'organization_id,rule_key,period_start',
          ignoreDuplicates: true,
        },
      ),
    )
  }
  await audit(db, job, 'insights.computed', {
    entity: 'insights',
    entityId: job.id,
    data: {
      candidates: candidates.length,
      rules: candidates.map(({ rule_key }) => rule_key),
    },
  })
  try {
    await checked(
      db.rpc('enqueue_alerts', { p_organization_id: organization_id }),
    )
  } catch (error) {
    console.error('No se pudieron encolar las alertas', error)
  }
}
