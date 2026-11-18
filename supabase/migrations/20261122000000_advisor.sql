create table public.advisor_runs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_start date not null,
  input_hash text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  cached boolean not null default false,
  driver text,
  model text,
  input_tokens int,
  output_tokens int,
  items int,
  error text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  finished_at timestamptz,
  unique (organization_id, id)
);

create index advisor_runs_organization_created_at_idx
  on public.advisor_runs(organization_id, created_at desc);

alter table public.advisor_runs enable row level security;
create policy advisor_runs_select on public.advisor_runs for select to authenticated
  using (organization_id in (select public.my_org_ids()));
revoke all on public.advisor_runs from public, anon, authenticated;
grant select on public.advisor_runs to authenticated;
grant all on public.advisor_runs to service_role;

alter table public.jobs drop constraint jobs_kind_check;
alter table public.jobs add constraint jobs_kind_check
  check (kind in ('import', 'revert_import', 'compute_insights', 'send_alerts', 'weekly_report', 'advisor'));

create unique index jobs_active_advisor_idx on public.jobs(organization_id)
  where kind = 'advisor' and status in ('queued', 'running');

-- Límite diario de consultas no cacheadas por organización. Vive en SQL para que ningún cliente pueda elegirlo.
create function public.advisor_daily_limit() returns int
language sql immutable set search_path = '' as $$ select 10 $$;
revoke all on function public.advisor_daily_limit() from public, anon, authenticated;

create function public.advisor_usage(p_organization_id uuid) returns table (used int, daily_limit int)
language plpgsql stable security definer set search_path = '' as $$
declare
  today date := (pg_catalog.now() at time zone 'America/Mexico_City')::date;
begin
  if p_organization_id is null or p_organization_id not in (select public.my_org_ids()) then
    raise exception 'Advisor usage denied' using errcode = '42501';
  end if;

  return query select count(*)::int, public.advisor_daily_limit() from public.advisor_runs r
  where r.organization_id = p_organization_id and not r.cached
    and r.created_at >= (today::timestamp at time zone 'America/Mexico_City')
    and r.created_at < ((today + 1)::timestamp at time zone 'America/Mexico_City')
    and (r.status <> 'failed' or r.error is null or r.error not in ('disabled', 'busy'));
end;
$$;

create function public.request_advisor(p_organization_id uuid, p_input_hash text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  period date := pg_catalog.date_trunc('month', pg_catalog.now() at time zone 'America/Mexico_City')::date;
  run_id uuid;
  cached_run public.advisor_runs;
  daily_limit int := public.advisor_daily_limit();
  used int;
begin
  if p_organization_id is null
    or p_organization_id not in (select public.my_org_ids_with_role('{owner,admin,analyst}')) then
    raise exception 'Advisor request denied' using errcode = '42501';
  end if;
  if p_input_hash is null or p_input_hash !~ '^[0-9A-Fa-f]{64}$' then
    raise exception 'Invalid advisor hash' using errcode = '22023';
  end if;

  -- Serializa solicitudes de la misma organización y protege la FK durante la petición.
  perform 1 from public.organizations o where o.id = p_organization_id for no key update;
  if not found then
    raise exception 'Advisor request denied' using errcode = '42501';
  end if;

  select r.id into run_id from public.advisor_runs r
  where r.organization_id = p_organization_id and r.status in ('queued', 'running')
  order by r.created_at desc, r.id desc limit 1;
  if found then
    return jsonb_build_object('status', 'running', 'run_id', run_id);
  end if;

  select r.* into cached_run from public.advisor_runs r
  where r.organization_id = p_organization_id and r.period_start = period
    and r.input_hash = p_input_hash and r.status = 'done'
  order by r.created_at desc, r.id desc limit 1;
  if found then
    insert into public.advisor_runs(organization_id, period_start, input_hash, status, cached,
      driver, model, items, requested_by, finished_at)
    values (p_organization_id, period, p_input_hash, 'done', true,
      cached_run.driver, cached_run.model, cached_run.items, auth.uid(), pg_catalog.now())
    returning id into run_id;
    return jsonb_build_object('status', 'cached', 'run_id', run_id);
  end if;

  select u.used into used from public.advisor_usage(p_organization_id) u;
  if used >= daily_limit then
    return jsonb_build_object('status', 'limit', 'used', used, 'limit', daily_limit);
  end if;

  insert into public.advisor_runs(organization_id, period_start, input_hash, requested_by)
  values (p_organization_id, period, p_input_hash, auth.uid())
  returning id into run_id;

  insert into public.jobs(organization_id, kind, payload)
  values (p_organization_id, 'advisor', jsonb_build_object('run_id', run_id))
  on conflict (organization_id) where kind = 'advisor' and status in ('queued', 'running')
    do nothing;
  if not found then
    update public.advisor_runs set status = 'failed', error = 'busy', finished_at = pg_catalog.now()
    where id = run_id;
    select (j.payload->>'run_id')::uuid into run_id from public.jobs j
    where j.organization_id = p_organization_id and j.kind = 'advisor'
      and j.status in ('queued', 'running');
    return jsonb_build_object('status', 'running', 'run_id', run_id);
  end if;

  insert into public.audit_log(organization_id, actor_user_id, actor_kind, action, entity, entity_id, data)
  values (p_organization_id, auth.uid(), 'user', 'advisor.requested', 'advisor_runs', run_id::text, '{}'::jsonb);
  return jsonb_build_object('status', 'queued', 'run_id', run_id, 'used', used + 1, 'limit', daily_limit);
end;
$$;

create function public.complete_advisor_run(p_run_id uuid, p_status text, p_error text,
  p_driver text, p_model text, p_input_tokens int, p_output_tokens int, p_items int)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  completed_run public.advisor_runs;
begin
  if p_status is null or p_status not in ('done', 'failed') then
    raise exception 'Invalid advisor completion status' using errcode = '22023';
  end if;

  update public.advisor_runs set status = p_status, error = p_error, driver = p_driver,
    model = p_model, input_tokens = p_input_tokens, output_tokens = p_output_tokens,
    items = p_items, finished_at = pg_catalog.now()
  where id = p_run_id and status in ('queued', 'running')
  returning * into completed_run;

  if found and p_status = 'done' and not completed_run.cached then
    update public.insights i set status = 'dismissed'
    where i.organization_id = completed_run.organization_id
      and i.period_start = completed_run.period_start and i.generated_by = 'llm' and i.status = 'new'
      and i.evidence->>'run_id' <> p_run_id::text;
  end if;
end;
$$;

revoke all on function public.request_advisor(uuid, text), public.advisor_usage(uuid),
  public.complete_advisor_run(uuid, text, text, text, text, int, int, int)
  from public, anon, authenticated, service_role;
grant execute on function public.request_advisor(uuid, text), public.advisor_usage(uuid)
  to authenticated;
grant execute on function public.complete_advisor_run(uuid, text, text, text, text, int, int, int)
  to service_role;
