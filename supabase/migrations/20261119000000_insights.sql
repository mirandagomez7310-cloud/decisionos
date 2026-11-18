create table public.insights (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module text not null check (module in ('executive', 'sales', 'profit', 'inventory', 'cash')),
  kind text not null check (kind in ('fact', 'hypothesis', 'suggestion')),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text not null,
  evidence jsonb not null,
  metric_snapshot jsonb not null,
  period_start date not null,
  period_end date not null,
  generated_by text not null check (generated_by in ('rule', 'llm')),
  rule_key text,
  status text not null default 'new' check (status in ('new', 'seen', 'dismissed', 'done')),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (kind <> 'fact' or generated_by = 'rule'),
  check (generated_by <> 'rule' or rule_key is not null),
  unique (organization_id, rule_key, period_start)
);

create index insights_organization_status_created_at_idx
  on public.insights(organization_id, status, created_at desc);
create trigger insights_set_updated_at before update on public.insights
  for each row execute function public.set_updated_at();

alter table public.insights enable row level security;
create policy insights_select on public.insights for select to authenticated
  using (organization_id in (select public.my_org_ids()));
revoke all on public.insights from public, anon, authenticated;
grant select on public.insights to authenticated;
grant all on public.insights to service_role;

grant select on public.sale_lines_enriched, public.sales, public.sale_lines, public.products,
  public.inventory_snapshots, public.receivables, public.customers to service_role;
grant execute on function public.metrics_summary(uuid, date, date, date, date),
  public.metrics_by_product(uuid, date, date, date, date),
  public.inventory_summary(uuid, date), public.inventory_by_product(uuid, date),
  public.receivables_summary(uuid, date), public.receivables_by_customer(uuid, date) to service_role;

create function public.evaluate_insight_rules(p_organization_id uuid, p_as_of date)
returns table (
  rule_key text, module text, severity text, period_start date, period_end date,
  evidence jsonb, metric_snapshot jsonb
)
language sql stable security invoker set search_path = '' as $$
with month_start as (
  select pg_catalog.date_trunc('month', p_as_of::timestamp)::date as cut_start
), periods as (
  select cut_start, (cut_start - interval '1 month')::date as closed_start,
    cut_start - 1 as closed_end, (cut_start - interval '2 months')::date as prev_start,
    (cut_start - interval '1 month')::date - 1 as prev_end
  from month_start
), summary as (
  select s.* from periods p cross join lateral
    public.metrics_summary(p_organization_id, p.closed_start, p.closed_end, p.prev_start, p.prev_end) s
), products as (
  select m.product_id, m.gross_margin,
    row_number() over (order by m.gross_margin, m.product_id) as position
  from periods p cross join lateral
    public.metrics_by_product(p_organization_id, p.closed_start, p.closed_end, p.prev_start, p.prev_end) m
  where m.gross_margin < 0
), customers as (
  select c.customer_id, c.overdue_balance,
    row_number() over (order by c.overdue_balance desc, c.customer_id) as position
  from public.receivables_by_customer(p_organization_id, p_as_of) c
  where c.risk = 'alto'
), closed_rules as (
  select r.*, 'metrics_summary'::text as metric, '{}'::jsonb as details
  from summary s cross join lateral (values
    ('sales_drop', 'sales', case when s.net_sales_change_pct <= -20 then 'critical' else 'warning' end,
      s.net_sales_change_pct <= -10,
      jsonb_build_object('net_sales', s.net_sales, 'prev_net_sales', s.prev_net_sales,
        'net_sales_change_pct', s.net_sales_change_pct)),
    ('margin_drop', 'profit', 'warning', s.margin_pct_change_pts <= -3,
      jsonb_build_object('margin_pct', s.margin_pct, 'prev_margin_pct', s.prev_margin_pct,
        'margin_pct_change_pts', s.margin_pct_change_pts)),
    ('low_cost_coverage', 'profit', 'info', s.coverage < 80,
      jsonb_build_object('coverage', s.coverage, 'margin_base', s.margin_base, 'net_sales', s.net_sales))
  ) r(rule_key, module, severity, triggered, snapshot)
  union all
  select 'negative_margin_products', 'profit', 'warning', count(*) > 0,
    jsonb_build_object('gross_margin', min(gross_margin)), 'metrics_by_product',
    jsonb_build_object('ids', jsonb_agg(product_id order by position) filter (where position <= 20), 'count', count(*))
  from products
), cut_rules as (
  select 'stale_inventory' as rule_key, 'inventory' as module, 'warning' as severity,
    i.stale_share_pct > 20 as triggered,
    jsonb_build_object('inventory_value', i.inventory_value, 'stale_value', i.stale_value,
      'stale_share_pct', i.stale_share_pct) as snapshot,
    'inventory_summary' as metric, '{}'::jsonb as details
  from public.inventory_summary(p_organization_id, p_as_of) i
  union all
  select 'high_risk_customers', 'cash', 'critical', count(*) > 0,
    jsonb_build_object('overdue_balance', max(overdue_balance), 'risk', 'alto'), 'receivables_by_customer',
    jsonb_build_object('ids', jsonb_agg(customer_id order by position) filter (where position <= 20), 'count', count(*))
  from customers
  union all
  select r.*, 'receivables_summary', '{}'::jsonb
  from public.receivables_summary(p_organization_id, p_as_of) s
  cross join lateral (values
    ('receivables_concentration', 'cash', 'info', s.customer_count > 5 and s.top5_share_pct > 50,
      jsonb_build_object('top5_share_pct', s.top5_share_pct, 'open_balance', s.open_balance)),
    ('overdue_share', 'cash', 'warning', s.overdue_pct > 30,
      jsonb_build_object('overdue_pct', s.overdue_pct, 'overdue_balance', s.overdue_balance,
        'open_balance', s.open_balance))
  ) r(rule_key, module, severity, triggered, snapshot)
)
select r.rule_key, r.module, r.severity, p.closed_start, p.closed_end,
  jsonb_build_object('metric', r.metric, 'from', p.closed_start, 'to', p.closed_end,
    'prev_from', p.prev_start, 'prev_to', p.prev_end) || r.details, r.snapshot
from closed_rules r cross join periods p where r.triggered
union all
select r.rule_key, r.module, r.severity, p.cut_start, p_as_of,
  jsonb_build_object('metric', r.metric, 'from', p.cut_start, 'to', p_as_of,
    'prev_from', null::date, 'prev_to', null::date) || r.details, r.snapshot
from cut_rules r cross join periods p where r.triggered;
$$;
revoke all on function public.evaluate_insight_rules(uuid, date) from public, anon, authenticated;
grant execute on function public.evaluate_insight_rules(uuid, date) to service_role;

create function public.set_insight_status(p_insight_id uuid, p_status text)
returns public.insights
language plpgsql security definer set search_path = '' as $$
declare
  insight public.insights;
  previous_status text;
begin
  if p_status is null or p_status not in ('seen', 'dismissed', 'done', 'new') then
    raise exception 'Invalid insight status' using errcode = '22023';
  end if;

  select i.status into previous_status from public.insights i
  where i.id = p_insight_id
    and i.organization_id in (select public.my_org_ids_with_role('{owner,admin,analyst}'))
  for update;
  if not found then
    raise exception 'Insight status change denied' using errcode = '42501';
  end if;

  update public.insights set status = p_status where id = p_insight_id returning * into insight;
  insert into public.audit_log(organization_id, actor_user_id, actor_kind, action, entity, entity_id, data)
  values (insight.organization_id, auth.uid(), 'user', 'insights.status_changed', 'insights', insight.id::text,
    jsonb_build_object('old', previous_status, 'new', p_status));
  return insight;
end;
$$;
revoke all on function public.set_insight_status(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.set_insight_status(uuid, text) to authenticated;

alter table public.jobs drop constraint jobs_kind_check;
alter table public.jobs add constraint jobs_kind_check check (kind in ('import', 'revert_import', 'compute_insights'));

create unique index jobs_active_compute_insights_idx on public.jobs(organization_id)
  where kind = 'compute_insights' and status in ('queued', 'running');

create function public.enqueue_insights(p_organization_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.jobs(organization_id, kind, payload)
  values (p_organization_id, 'compute_insights', '{}'::jsonb)
  on conflict (organization_id) where kind = 'compute_insights' and status in ('queued', 'running')
    do nothing;
  return found;
end;
$$;
revoke all on function public.enqueue_insights(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_insights(uuid) to service_role;

create function public.enqueue_daily_insights() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  enqueued integer;
begin
  insert into public.jobs(organization_id, kind, payload)
  select o.id, 'compute_insights', '{}'::jsonb from public.organizations o
  where (exists (select 1 from public.sales s where s.organization_id = o.id)
    or exists (select 1 from public.inventory_snapshots i where i.organization_id = o.id)
    or exists (select 1 from public.receivables r where r.organization_id = o.id))
  order by o.id
  on conflict (organization_id) where kind = 'compute_insights' and status in ('queued', 'running')
    do nothing;
  get diagnostics enqueued = row_count;
  return enqueued;
end;
$$;
revoke all on function public.enqueue_daily_insights() from public, anon, authenticated;
grant execute on function public.enqueue_daily_insights() to service_role;
