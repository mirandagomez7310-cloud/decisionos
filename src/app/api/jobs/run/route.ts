import { timingSafeEqual } from 'node:crypto'
import { env } from '@/env'
import { runPendingJobs } from '@/lib/server/jobs'
export async function POST(request: Request) {
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${env.JOBS_SECRET}`)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return new Response(null, { status: 401 })
  await runPendingJobs()
  return new Response(null, { status: 204 })
}
