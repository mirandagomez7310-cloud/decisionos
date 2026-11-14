create view public.sale_lines_enriched with (security_invoker = true) as
select l.*, s.sold_on, s.status, s.customer_id from public.sale_lines l
join public.sales s on (s.organization_id, s.id) = (l.organization_id, l.sale_id);
grant select on public.sale_lines_enriched to authenticated;

create function public.metrics_summary(p_organization_id uuid, p_from date, p_to date, p_prev_from date, p_prev_to date) returns table (net_sales numeric, prev_net_sales numeric, net_sales_change_pct numeric, sales_count bigint, gross_margin numeric, margin_base numeric, margin_pct numeric, prev_margin_pct numeric, margin_pct_change_pts numeric, coverage numeric)
language sql stable security invoker set search_path = '' as $$
with totals as (select coalesce(sum(line_total) filter (where sold_on between p_from and p_to),0) as net,
coalesce(sum(line_total) filter (where sold_on between p_prev_from and p_prev_to),0) as prev,
coalesce(sum(line_total) filter (where sold_on between p_from and p_to and unit_cost is not null),0) as base,
sum(line_total) filter (where sold_on between p_prev_from and p_prev_to and unit_cost is not null) as prev_base,
round(coalesce(sum(line_total-quantity*unit_cost) filter (where sold_on between p_from and p_to),0),2) as margin,
round(sum(line_total-quantity*unit_cost) filter (where sold_on between p_prev_from and p_prev_to),2) as prev_margin from public.sale_lines_enriched where organization_id=p_organization_id and status='completed'
and (sold_on between p_from and p_to or sold_on between p_prev_from and p_prev_to)), ratios as (
select *, round(margin/nullif(base,0)*100,1) pct, round(prev_margin/nullif(prev_base,0)*100,1) prev_pct from totals)
select net, prev, round((net-prev)/nullif(prev,0)*100,1),
(select count(*) from public.sales where organization_id=p_organization_id and status='completed' and sold_on between p_from and p_to),
margin, base, pct, prev_pct, round(pct-prev_pct,1), round(base/nullif(net,0)*100,1) from ratios;
$$;
revoke all on function public.metrics_summary(uuid, date, date, date, date) from public, anon;
grant execute on function public.metrics_summary(uuid, date, date, date, date) to authenticated;

create function public.metrics_daily_sales(p_organization_id uuid, p_from date, p_to date) returns table (day date, net_sales numeric)
language sql stable security invoker set search_path = '' as $$
select p_from+d.n, coalesce(t.net,0) from pg_catalog.generate_series(0,p_to-p_from) d(n)
left join (select sold_on, sum(line_total) net from public.sale_lines_enriched
where organization_id=p_organization_id and status='completed' and sold_on between p_from and p_to group by sold_on) t
on t.sold_on=p_from+d.n order by d.n;
$$;
revoke all on function public.metrics_daily_sales(uuid, date, date) from public, anon;
grant execute on function public.metrics_daily_sales(uuid, date, date) to authenticated;

create function public.metrics_by_product(p_organization_id uuid, p_from date, p_to date, p_prev_from date, p_prev_to date) returns table (product_id uuid, sku text, name text, net_sales numeric, prev_net_sales numeric, delta numeric, delta_pct numeric, gross_margin numeric, margin_pct numeric, coverage numeric)
language sql stable security invoker set search_path = '' as $$
with totals as (select product_id, coalesce(sum(line_total) filter (where sold_on between p_from and p_to),0) as net,
coalesce(sum(line_total) filter (where sold_on between p_prev_from and p_prev_to),0) as prev,
coalesce(sum(line_total) filter (where sold_on between p_from and p_to and unit_cost is not null),0) as base,
sum(line_total) filter (where sold_on between p_prev_from and p_prev_to and unit_cost is not null) as prev_base,
round(coalesce(sum(line_total-quantity*unit_cost) filter (where sold_on between p_from and p_to),0),2) as margin,
round(sum(line_total-quantity*unit_cost) filter (where sold_on between p_prev_from and p_prev_to),2) as prev_margin from public.sale_lines_enriched where organization_id=p_organization_id and status='completed'
and (sold_on between p_from and p_to or sold_on between p_prev_from and p_prev_to) group by product_id)
select t.product_id, c.sku, c.name, net, prev, net-prev, round((net-prev)/nullif(prev,0)*100,1),
margin, round(margin/nullif(base,0)*100,1), round(base/nullif(net,0)*100,1)
from totals t join public.products c on c.id=t.product_id and c.organization_id=p_organization_id;
$$;
revoke all on function public.metrics_by_product(uuid, date, date, date, date) from public, anon;
grant execute on function public.metrics_by_product(uuid, date, date, date, date) to authenticated;

create function public.metrics_by_customer(p_organization_id uuid, p_from date, p_to date, p_prev_from date, p_prev_to date) returns table (customer_id uuid, code text, name text, net_sales numeric, prev_net_sales numeric, delta numeric, delta_pct numeric, gross_margin numeric, margin_pct numeric, coverage numeric)
language sql stable security invoker set search_path = '' as $$
with totals as (select customer_id, coalesce(sum(line_total) filter (where sold_on between p_from and p_to),0) as net,
coalesce(sum(line_total) filter (where sold_on between p_prev_from and p_prev_to),0) as prev,
coalesce(sum(line_total) filter (where sold_on between p_from and p_to and unit_cost is not null),0) as base,
sum(line_total) filter (where sold_on between p_prev_from and p_prev_to and unit_cost is not null) as prev_base,
round(coalesce(sum(line_total-quantity*unit_cost) filter (where sold_on between p_from and p_to),0),2) as margin,
round(sum(line_total-quantity*unit_cost) filter (where sold_on between p_prev_from and p_prev_to),2) as prev_margin from public.sale_lines_enriched where organization_id=p_organization_id and status='completed'
and (sold_on between p_from and p_to or sold_on between p_prev_from and p_prev_to) group by customer_id)
select t.customer_id, c.code, c.name, net, prev, net-prev, round((net-prev)/nullif(prev,0)*100,1),
margin, round(margin/nullif(base,0)*100,1), round(base/nullif(net,0)*100,1)
from totals t join public.customers c on c.id=t.customer_id and c.organization_id=p_organization_id;
$$;
revoke all on function public.metrics_by_customer(uuid, date, date, date, date) from public, anon;
grant execute on function public.metrics_by_customer(uuid, date, date, date, date) to authenticated;
