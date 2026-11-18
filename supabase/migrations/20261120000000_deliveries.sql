alter table public.insights add unique (organization_id, id);

create table public.deliveries (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('alert', 'weekly_report')),
  dedupe_key text not null,
  insight_id uuid,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  foreign key (organization_id, insight_id) references public.insights(organization_id, id) on delete cascade,
  unique (organization_id, dedupe_key)
);
create trigger deliveries_set_updated_at before update on public.deliveries
  for each row execute function public.set_updated_at();

alter table public.deliveries enable row level security;
revoke all on public.deliveries from public, anon, authenticated;
grant all on public.deliveries to service_role;

create function public.alert_recipients(p_organization_id uuid)
returns table (user_id uuid, email text)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email::text
  from public.memberships m join auth.users u on u.id = m.user_id
  where m.organization_id = p_organization_id and m.role in ('owner', 'admin')
    and u.email <> '';
$$;

create function public.pending_alerts(p_organization_id uuid)
returns table (insight_id uuid, recipient_user_id uuid, recipient_email text)
language sql stable security definer set search_path = '' as $$
  select i.id, r.user_id, r.email
  from public.insights i cross join public.alert_recipients(p_organization_id) r
  where i.organization_id = p_organization_id
    and i.severity in ('warning', 'critical') and i.status = 'new'
    and i.created_at >= pg_catalog.now() - interval '7 days'
    and not exists (
      select 1 from public.deliveries d
      where d.organization_id = i.organization_id
        and d.dedupe_key = 'alert:' || i.id || ':' || r.user_id
        and (d.status = 'sent' or (d.status = 'failed' and d.attempts >= 3))
    )
  order by r.user_id, i.created_at, i.id;
$$;

alter table public.jobs drop constraint jobs_kind_check;
alter table public.jobs add constraint jobs_kind_check
  check (kind in ('import', 'revert_import', 'compute_insights', 'send_alerts', 'weekly_report'));

create unique index jobs_active_send_alerts_idx on public.jobs(organization_id)
  where kind = 'send_alerts' and status in ('queued', 'running');

create function public.enqueue_alerts(p_organization_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.jobs(organization_id, kind, payload)
  values (p_organization_id, 'send_alerts', '{}'::jsonb)
  on conflict (organization_id) where kind = 'send_alerts' and status in ('queued', 'running')
    do nothing;
  return found;
end;
$$;

revoke all on function public.alert_recipients(uuid), public.pending_alerts(uuid), public.enqueue_alerts(uuid)
  from public, anon, authenticated;
grant execute on function public.alert_recipients(uuid), public.pending_alerts(uuid), public.enqueue_alerts(uuid)
  to service_role;
