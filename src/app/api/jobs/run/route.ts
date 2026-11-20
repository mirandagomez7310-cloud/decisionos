import { timingSafeEqual } from 'node:crypto'
import { env } from '@/env'
import { runPendingJobs } from '@/lib/server/jobs'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return new Response(null, { status: 401 })

  const schedule = request.headers.get('ce-vssschedulename')
  if (schedule === 'daily-insights' || schedule === 'weekly-reports') {
    const { error } = await createAdminClient().rpc(
      schedule === 'daily-insights'
        ? 'enqueue_daily_insights'
        : 'enqueue_weekly_reports',
    )
    if (error) {
      console.error(
        'No se pudo encolar la tarea programada',
        schedule,
        error.code,
      )
      return new Response(null, { status: 500 })
    }
  } else if (schedule !== null && schedule !== 'jobs-sweep') {
    return new Response(null, { status: 400 })
  }

  await runPendingJobs()
  return new Response(null, { status: 204 })
}
