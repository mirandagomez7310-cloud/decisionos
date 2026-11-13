create table public.imports (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('sales', 'products', 'customers', 'inventory', 'receivables')),
  storage_path text not null check (storage_path like organization_id::text || '/%'),
  original_filename text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed', 'reverted')),
  column_mapping jsonb not null default '{}',
  row_count int not null default 0 check (row_count >= 0),
  ok_count int not null default 0 check (ok_count >= 0),
  error_count int not null default 0 check (error_count >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default pg_catalog.now(),
  finished_at timestamptz,
  unique (organization_id, id)
);

create table public.import_rows (
  id bigint generated always as identity primary key,
  import_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  row_number int not null check (row_number > 0),
  raw jsonb not null,
  error text,
  foreign key (organization_id, import_id) references public.imports(organization_id, id)
);
create index import_rows_import_id_row_number_idx on public.import_rows(import_id, row_number);

create table public.jobs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('import', 'revert_import')),
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  attempts int not null default 0 check (attempts >= 0),
  max_attempts int not null default 3 check (max_attempts > 0),
  run_after timestamptz not null default pg_catalog.now(),
  locked_at timestamptz,
  locked_by text,
  progress jsonb not null default '{}',
  last_error text,
  created_at timestamptz not null default pg_catalog.now(),
  finished_at timestamptz
);
create index jobs_queued_run_after_idx on public.jobs(run_after) where status = 'queued';

alter table public.sales add constraint sales_source_import_fkey
  foreign key (organization_id, source_import_id) references public.imports(organization_id, id);
alter table public.inventory_snapshots add constraint inventory_snapshots_source_import_fkey
  foreign key (organization_id, source_import_id) references public.imports(organization_id, id);
alter table public.receivables add constraint receivables_source_import_fkey
  foreign key (organization_id, source_import_id) references public.imports(organization_id, id);

alter table public.imports enable row level security;
create policy imports_select on public.imports for select to authenticated
using (organization_id in (select public.my_org_ids()));
create policy imports_insert on public.imports for insert to authenticated
with check (
  organization_id in (select public.my_org_ids_with_role('{owner,admin}'))
  and created_by = (select auth.uid()) and status = 'pending'
);
revoke all on public.imports from public, anon, authenticated;
grant select on public.imports to authenticated;
grant insert (organization_id, kind, storage_path, original_filename, column_mapping, created_by)
  on public.imports to authenticated;

alter table public.import_rows enable row level security;
create policy import_rows_select on public.import_rows for select to authenticated
using (organization_id in (select public.my_org_ids_with_role('{owner,admin}')));
revoke all on public.import_rows from public, anon, authenticated;
revoke all on sequence public.import_rows_id_seq from public, anon, authenticated;
grant select on public.import_rows to authenticated;

alter table public.jobs enable row level security;
create policy jobs_select on public.jobs for select to authenticated
using (organization_id in (select public.my_org_ids()));
revoke all on public.jobs from public, anon, authenticated;
grant select on public.jobs to authenticated;
grant all on public.imports, public.import_rows, public.jobs to service_role;
grant all on sequence public.import_rows_id_seq to service_role;

create function public.claim_job(worker text, kinds text[]) returns public.jobs
language plpgsql security definer set search_path = '' as $$
declare claimed public.jobs;
begin
  update public.jobs j
  set status = 'running', locked_at = pg_catalog.now(), locked_by = worker,
      attempts = j.attempts + 1
  where j.id = (
    select q.id from public.jobs q
    where q.status = 'queued' and q.run_after <= pg_catalog.now()
      and q.attempts < q.max_attempts and q.kind = any(kinds)
    order by q.run_after, q.id
    for update skip locked limit 1
  ) returning j.* into claimed;
  if not found then return null; end if;
  return claimed;
end;
$$;

create function public.complete_job(id uuid, status text, last_error text) returns public.jobs
language plpgsql security definer set search_path = '' as $$
declare completed public.jobs;
begin
  if status is null or status not in ('done', 'failed') then
    raise exception 'status must be done or failed' using errcode = '22023';
  end if;
  update public.jobs j
  set status = case when $2 = 'failed' and j.attempts < j.max_attempts then 'queued' else $2 end,
      finished_at = case when $2 = 'failed' and j.attempts < j.max_attempts then null else pg_catalog.now() end,
      run_after = case when $2 = 'failed' and j.attempts < j.max_attempts
        then pg_catalog.now() + interval '1 minute' * j.attempts else j.run_after end,
      locked_at = null, locked_by = null, last_error = $3
  where j.id = $1 and j.status = 'running'
  returning j.* into completed;
  if not found then return null; end if;
  return completed;
end;
$$;
revoke execute on function public.claim_job(text, text[]), public.complete_job(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_job(text, text[]), public.complete_job(uuid, text, text)
  to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('imports', 'imports', false, 26214400, array[
  'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel', 'text/plain'
]);

create policy storage_imports_select on storage.objects for select to authenticated
using (bucket_id = 'imports' and (storage.foldername(name))[1] in (
  select id::text from public.my_org_ids_with_role('{owner,admin}') as id
));
create policy storage_imports_insert on storage.objects for insert to authenticated
with check (bucket_id = 'imports' and (storage.foldername(name))[1] in (
  select id::text from public.my_org_ids_with_role('{owner,admin}') as id
));
