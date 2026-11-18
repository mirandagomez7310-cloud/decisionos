import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { handleSendAlerts } from './handlers/alerts'
import { handleImport } from './handlers/import'
import { handleComputeInsights } from './handlers/insights'
import { handleRevert } from './handlers/revert'
import { handleWeeklyReport } from './handlers/weekly-report'
import { checked, importId, workerClient } from './shared'
export async function runPendingJobs({ maxJobs = 5, worker = 'web' } = {}) {
  try {
    const db = workerClient(createAdminClient())
    for (let i = 0; i < maxJobs; i++) {
      const job = await checked(
        db.rpc('claim_job', {
          worker,
          kinds: [
            'import',
            'revert_import',
            'compute_insights',
            'send_alerts',
            'weekly_report',
          ],
        }),
      )
      if (!job?.id) break
      try {
        if (job.kind === 'import') await handleImport(db, job)
        else if (job.kind === 'revert_import') await handleRevert(db, job)
        else if (job.kind === 'compute_insights')
          await handleComputeInsights(db, job)
        else if (job.kind === 'send_alerts') await handleSendAlerts(db, job)
        else if (job.kind === 'weekly_report') await handleWeeklyReport(db, job)
        await checked(
          db.rpc('complete_job', {
            id: job.id,
            status: 'done',
            last_error: '',
          }),
        )
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        try {
          await checked(
            db.rpc('complete_job', {
              id: job.id,
              status: 'failed',
              last_error: message,
            }),
          )
          if (
            job.attempts >= job.max_attempts &&
            (job.kind === 'import' || job.kind === 'revert_import')
          )
            await checked(
              db
                .from('imports')
                .update({
                  status: 'failed',
                  finished_at: new Date().toISOString(),
                })
                .eq('organization_id', job.organization_id!)
                .eq('id', importId(job)),
            )
        } catch (error) {
          console.error('No se pudo registrar el fallo del job', error)
        }
      }
    }
  } catch (error) {
    console.error('No se pudo reclamar un job', error)
  }
}
