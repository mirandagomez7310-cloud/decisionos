import { env } from '@/env'
import { runPendingJobs } from '@/lib/server/jobs'
export async function POST(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${env.JOBS_SECRET}`)
    return new Response(null, { status: 401 })
  await runPendingJobs()
  return new Response(null, { status: 204 })
}
