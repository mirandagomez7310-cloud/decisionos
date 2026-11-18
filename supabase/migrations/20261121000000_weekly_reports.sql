create unique index jobs_active_weekly_report_idx on public.jobs(organization_id)
  where kind = 'weekly_report' and status in ('queued', 'running');

-- En fase 7 se agenda los lunes junto con enqueue_daily_insights.
create function public.enqueue_weekly_reports() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  enqueued integer;
begin
  insert into public.jobs(organization_id, kind, payload)
  select o.id, 'weekly_report', '{}'::jsonb from public.organizations o
  where exists (select 1 from public.sales s where s.organization_id = o.id)
    or exists (select 1 from public.inventory_snapshots i where i.organization_id = o.id)
    or exists (select 1 from public.receivables r where r.organization_id = o.id)
  order by o.id
  on conflict (organization_id) where kind = 'weekly_report' and status in ('queued', 'running')
    do nothing;
  get diagnostics enqueued = row_count;
  return enqueued;
end;
$$;
revoke all on function public.enqueue_weekly_reports() from public, anon, authenticated;
grant execute on function public.enqueue_weekly_reports() to service_role;
