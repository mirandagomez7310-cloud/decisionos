import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { handleImport } from './handlers/import'
import { handleRevert } from './handlers/revert'
import { checked, importId, workerClient } from './shared'
export async function runPendingJobs({ maxJobs = 5, worker = 'web' } = {}) {
  try {
    const db = workerClient(createAdminClient())
    for (let i = 0; i < maxJobs; i++) {
      const job = await checked(
        db.rpc('claim_job', { worker, kinds: ['import', 'revert_import'] }),
      )
      if (!job?.id) break
      try {
        if (job.kind === 'import') await handleImport(db, job)
        else await handleRevert(db, job)
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
          if (job.attempts >= job.max_attempts)
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
