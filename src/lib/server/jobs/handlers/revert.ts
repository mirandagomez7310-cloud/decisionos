import 'server-only'
import { audit, checked, importId, type Client, type Job } from '../shared'
export async function handleRevert(db: Client, job: Job) {
  const id = importId(job)
  await checked(
    db.rpc('revert_import', {
      p_organization_id: job.organization_id!,
      p_import_id: id,
    }),
  )
  await audit(db, job, 'imports.reverted')
}
