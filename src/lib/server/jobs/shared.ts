import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'
import type { SupabaseClient } from '@supabase/supabase-js'
type DecimalWrites<T> = {
  [K in keyof T]: number extends T[K] ? T[K] | string : T[K]
}
type WorkerDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: {
      [K in keyof Database['public']['Tables']]: Omit<
        Database['public']['Tables'][K],
        'Insert' | 'Update'
      > & {
        Insert: DecimalWrites<Database['public']['Tables'][K]['Insert']>
        Update: DecimalWrites<Database['public']['Tables'][K]['Update']>
      }
    }
  }
}
// PostgREST acepta decimales como texto; los tipos generados solo contemplan number.
export const workerClient = (db: ReturnType<typeof createAdminClient>) =>
  db as unknown as SupabaseClient<WorkerDatabase>
export type Client = ReturnType<typeof workerClient>
export type Job = Database['public']['Tables']['jobs']['Row']
export async function checked<T>(
  query: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}
export function batches<T>(rows: T[]): T[][] {
  const result: T[][] = []
  for (let i = 0; i < rows.length; i += 500) result.push(rows.slice(i, i + 500))
  return result
}
export function importId(job: Job): string {
  const payload = job.payload
  if (
    !job.organization_id ||
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    typeof payload.import_id !== 'string'
  )
    throw new Error('Job sin organización o import_id válido')
  return payload.import_id
}
export async function audit(db: Client, job: Job, action: string) {
  await checked(
    db
      .from('audit_log')
      .insert({
        organization_id: job.organization_id!,
        actor_kind: 'system',
        action,
        entity: 'imports',
        entity_id: importId(job),
      }),
  )
}
