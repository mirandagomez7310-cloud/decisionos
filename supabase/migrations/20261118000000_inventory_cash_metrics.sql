create function public.inventory_by_product(p_organization_id uuid, p_as_of date)
returns table (
  product_id uuid, sku text, name text, quantity numeric, unit_cost numeric,
  inventory_value numeric, cogs_90d numeric, days_on_hand numeric,
  last_sold_on date, days_since_sale int, is_stale boolean
)
language sql stable security invoker set search_path = '' as $$
with stock as (
  select i.product_id, p.sku, p.name, i.quantity, coalesce(i.unit_cost, p.standard_cost) as unit_cost
  from public.inventory_snapshots i
  join public.products p on (p.organization_id, p.id) = (i.organization_id, i.product_id)
  where i.organization_id = p_organization_id and i.quantity > 0
    and i.snapshot_on = (
      select max(snapshot_on) from public.inventory_snapshots
      where organization_id = p_organization_id and snapshot_on <= p_as_of
    )
), totals as (
  select stock.*, round(quantity * stock.unit_cost, 2) as value, movement.last_sale,
    coalesce(movement.cost, 0) as cost
  from stock
  cross join lateral (
    select max(l.sold_on) as last_sale,
      sum(l.quantity * l.unit_cost) filter (where l.sold_on >= p_as_of - 89) as cost
    from public.sale_lines_enriched l
    where l.organization_id = p_organization_id and l.product_id = stock.product_id
      and l.status = 'completed' and l.sold_on <= p_as_of
  ) movement
)
select product_id, sku, name, quantity, unit_cost, value, round(cost, 2),
  case when cost > 0 then round(value * 90 / cost, 1) end,
  last_sale, p_as_of - last_sale, last_sale is null or last_sale < p_as_of - 89
from totals;
$$;

create function public.inventory_summary(p_organization_id uuid, p_as_of date)
returns table (
  snapshot_on date, inventory_value numeric, value_coverage numeric, cogs_90d numeric,
  days_on_hand numeric, turnover numeric, stale_value numeric, stale_count bigint, product_count bigint
)
language sql stable security invoker set search_path = '' as $$
with snapshot as (
  select max(snapshot_on) as stock_on
  from public.inventory_snapshots
  where organization_id = p_organization_id and snapshot_on <= p_as_of
), stock as (
  select round(coalesce(sum(quantity * unit_cost), 0), 2) as value,
    round(count(unit_cost) * 100.0 / nullif(count(*), 0), 1) as coverage,
    round(coalesce(sum(quantity * unit_cost) filter (where is_stale), 0), 2) as stale,
    count(*) filter (where is_stale) as stale_count, count(*) as products
  from public.inventory_by_product(p_organization_id, p_as_of)
), costs as (
  select coalesce(sum(quantity * unit_cost), 0) as cost
  from public.sale_lines_enriched
  where organization_id = p_organization_id and status = 'completed'
    and sold_on between p_as_of - 89 and p_as_of
    and (select stock_on from snapshot) is not null
)
select stock_on, value, coverage, round(cost, 2),
  case when cost > 0 then round(value * 90 / cost, 1) end,
  round(cost * 365 / (90 * nullif(value, 0)), 1),
  stale, stale_count, products
from snapshot cross join stock cross join costs;
$$;

create function public.receivables_by_customer(p_organization_id uuid, p_as_of date)
returns table (
  customer_id uuid, code text, name text, open_balance numeric, overdue_balance numeric,
  current_balance numeric, d1_30 numeric, d31_60 numeric, d61_90 numeric, d90_plus numeric,
  max_days_overdue int, credit_limit numeric, credit_used_pct numeric, share_pct numeric, risk text
)
language sql stable security invoker set search_path = '' as $$
with open_items as (
  select r.customer_id, r.amount - r.paid_amount as balance, p_as_of - r.due_on as days
  from public.receivables r
  where r.organization_id = p_organization_id and r.issued_on <= p_as_of and r.amount > r.paid_amount
), totals as (
  select customer_id, sum(balance) as total,
    coalesce(sum(balance) filter (where days > 0), 0) as overdue,
    coalesce(sum(balance) filter (where days <= 0), 0) as current_amount,
    coalesce(sum(balance) filter (where days between 1 and 30), 0) as days_1_30,
    coalesce(sum(balance) filter (where days between 31 and 60), 0) as days_31_60,
    coalesce(sum(balance) filter (where days between 61 and 90), 0) as days_61_90,
    coalesce(sum(balance) filter (where days > 90), 0) as days_91_plus,
    greatest(max(days), 0) as max_days
  from open_items
  group by customer_id
)
select t.customer_id, c.code, c.name, t.total, t.overdue, t.current_amount,
  t.days_1_30, t.days_31_60, t.days_61_90, t.days_91_plus, t.max_days, c.credit_limit,
  round(t.total * 100 / nullif(c.credit_limit, 0), 1),
  round(t.total * 100 / sum(t.total) over (), 1),
  case when t.max_days > 90 or (c.credit_limit > 0 and t.total > c.credit_limit) then 'alto'
    when t.max_days > 30 then 'medio'
    else 'bajo'
  end
from totals t
join public.customers c on c.id = t.customer_id and c.organization_id = p_organization_id;
$$;

create function public.receivables_summary(p_organization_id uuid, p_as_of date)
returns table (
  open_balance numeric, overdue_balance numeric, overdue_pct numeric, current_balance numeric,
  d1_30 numeric, d31_60 numeric, d61_90 numeric, d90_plus numeric, customer_count bigint, top5_share_pct numeric
)
language sql stable security invoker set search_path = '' as $$
with balances as (
  select b.*, row_number() over (order by b.open_balance desc, b.customer_id) as position
  from public.receivables_by_customer(p_organization_id, p_as_of) b
)
select coalesce(sum(open_balance), 0), coalesce(sum(overdue_balance), 0),
  round(sum(overdue_balance) * 100 / nullif(sum(open_balance), 0), 1),
  coalesce(sum(current_balance), 0), coalesce(sum(d1_30), 0), coalesce(sum(d31_60), 0),
  coalesce(sum(d61_90), 0), coalesce(sum(d90_plus), 0), count(*),
  round(sum(open_balance) filter (where position <= 5) * 100 / nullif(sum(open_balance), 0), 1)
from balances;
$$;

revoke all on function public.inventory_summary(uuid, date), public.inventory_by_product(uuid, date),
  public.receivables_summary(uuid, date), public.receivables_by_customer(uuid, date) from public, anon;
grant execute on function public.inventory_summary(uuid, date), public.inventory_by_product(uuid, date),
  public.receivables_summary(uuid, date), public.receivables_by_customer(uuid, date) to authenticated;
