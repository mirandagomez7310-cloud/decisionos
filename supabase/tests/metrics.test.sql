begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(25);
insert into auth.users(id,email) values ('10000000-0000-0000-0000-000000000003','metrics@test.invalid');
insert into public.organizations(id,name,slug) values ('10000000-0000-0000-0000-000000000001','A','metrics-a'),('10000000-0000-0000-0000-000000000002','B','metrics-b');
insert into public.memberships(organization_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','owner');
insert into public.products(id,organization_id,sku,name) values ('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','P','Product'),('10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','Q','Previous'),('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000002','R','Hidden');
insert into public.customers(id,organization_id,code,name) values ('10000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','C','Customer'),('10000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','D','Previous'),('10000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000002','E','Hidden');
insert into public.sales(id,organization_id,external_ref,customer_id,sold_on,status,subtotal,tax,total) values
('10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','10','10000000-0000-0000-0000-000000000007','2026-11-01','completed',999,0,999),
('10000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','11','10000000-0000-0000-0000-000000000007','2026-11-03','completed',999,0,999),
('10000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000001','12','10000000-0000-0000-0000-000000000007','2026-10-01','completed',999,0,999),
('10000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000001','13','10000000-0000-0000-0000-000000000008','2026-10-01','completed',999,0,999),
('10000000-0000-0000-0000-000000000014','10000000-0000-0000-0000-000000000001','14','10000000-0000-0000-0000-000000000007','2026-11-01','cancelled',999,0,999),
('10000000-0000-0000-0000-000000000015','10000000-0000-0000-0000-000000000001','15','10000000-0000-0000-0000-000000000007','2026-11-01','returned',999,0,999),
('10000000-0000-0000-0000-000000000016','10000000-0000-0000-0000-000000000002','16','10000000-0000-0000-0000-000000000009','2026-11-01','completed',999,0,999);
insert into public.sale_lines(organization_id,sale_id,product_id,quantity,unit_price,unit_cost,line_total) values
('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000004',1,1,.04,.10),
('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000004',1,1,.08,.20),
('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000004',1.333,1,.10,.40),
('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000004',1,1,null,.30),
('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000004',1,1,.20,.50),
('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000005',1,1,.10,.20),
('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000014','10000000-0000-0000-0000-000000000004',1,1,0,100),
('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000015','10000000-0000-0000-0000-000000000004',1,1,0,200),
('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000016','10000000-0000-0000-0000-000000000006',1,1,0,900);
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select net_sales from public.metrics_summary('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03')),1.00::numeric,'net_sales: exacto');
select is((select prev_net_sales from public.metrics_summary('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03')),.70::numeric,'prev_net_sales: exacto');
select is((select net_sales_change_pct from public.metrics_summary('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03')),42.9::numeric,'net_sales_change_pct: exacto');
select is((select gross_margin from public.metrics_summary('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03')),.45::numeric,'gross_margin: exacto');
select is((select margin_base from public.metrics_summary('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03')),.70::numeric,'margin_base: exacto');
select is((select margin_pct from public.metrics_summary('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03')),64.3::numeric,'margin_pct: exacto');
select is((select prev_margin_pct from public.metrics_summary('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03')),57.1::numeric,'prev_margin_pct: exacto');
select is((select margin_pct_change_pts from public.metrics_summary('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03')),7.2::numeric,'margin_pct_change_pts: exacto');
select is((select coverage from public.metrics_summary('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03')),70.0::numeric,'coverage: exacto');
select is((select sales_count from public.metrics_summary('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03')),2::bigint,'cuenta cabeceras completed');
select results_eq($$select net_sales, prev_net_sales, net_sales_change_pct, margin_pct, prev_margin_pct, margin_pct_change_pts, coverage from public.metrics_summary('10000000-0000-0000-0000-000000000001','2025-01-01','2025-01-03','2024-01-01','2024-01-03')$$::text,$$values (0::numeric,0::numeric,null::numeric,null::numeric,null::numeric,null::numeric,null::numeric)$$::text,'sin datos: ceros y sin comparación');
select results_eq($$select day,net_sales from public.metrics_daily_sales('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03') order by day$$::text,$$values ('2026-11-01'::date,.30::numeric),('2026-11-02'::date,0::numeric),('2026-11-03'::date,.70::numeric)$$::text,'serie inclusiva y día sin ventas');
select results_eq($$select product_id,sku,name,net_sales,prev_net_sales,delta,delta_pct,gross_margin,margin_pct,coverage from public.metrics_by_product('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03') order by sku$$::text,
$$values ('10000000-0000-0000-0000-000000000004'::uuid,'P'::text,'Product'::text,1::numeric,.50::numeric,.50::numeric,100.0::numeric,.45::numeric,64.3::numeric,70.0::numeric),('10000000-0000-0000-0000-000000000005'::uuid,'Q','Previous',0::numeric,.20::numeric,-.20::numeric,-100.0::numeric,0::numeric,null::numeric,null::numeric)$$::text,'product: actual y solo anterior');
select results_eq($$select customer_id,code,name,net_sales,prev_net_sales,delta,delta_pct,gross_margin,margin_pct,coverage from public.metrics_by_customer('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03') order by code$$::text,
$$values ('10000000-0000-0000-0000-000000000007'::uuid,'C'::text,'Customer'::text,1::numeric,.50::numeric,.50::numeric,100.0::numeric,.45::numeric,64.3::numeric,70.0::numeric),('10000000-0000-0000-0000-000000000008'::uuid,'D','Previous',0::numeric,.20::numeric,-.20::numeric,-100.0::numeric,0::numeric,null::numeric,null::numeric)$$::text,'customer: actual y solo anterior');
select is((select net_sales_change_pct from public.metrics_summary('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2025-01-01','2025-01-03')),null::numeric,'anterior cero: sin comparación');
select results_eq($$select net_sales,sales_count,gross_margin,margin_base from public.metrics_summary('10000000-0000-0000-0000-000000000002','2026-11-01','2026-11-03','2026-10-01','2026-10-03')$$::text,$$values (0::numeric,0::bigint,0::numeric,0::numeric)$$::text,'B: resumen cero');
select is_empty($$select * from public.metrics_by_product('10000000-0000-0000-0000-000000000002','2026-11-01','2026-11-03','2026-10-01','2026-10-03')$$::text,'B: product vacío');
select is_empty($$select * from public.metrics_by_customer('10000000-0000-0000-0000-000000000002','2026-11-01','2026-11-03','2026-10-01','2026-10-03')$$::text,'B: customer vacío');
select is_empty($$select * from public.sale_lines_enriched where organization_id='10000000-0000-0000-0000-000000000002'$$::text,'vista: security invoker oculta B');
select is((select count(*) from public.sale_lines_enriched),8::bigint,'vista: A visible');
select results_eq($$select net_sales from public.metrics_daily_sales('10000000-0000-0000-0000-000000000002','2026-11-01','2026-11-01')$$::text,$$values (0::numeric)$$::text,'B: serie en cero');
reset role;
set local role anon;
select throws_ok($$select * from public.metrics_summary('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03')$$::text,'42501',null::text,'anon: summary denegada');
select throws_ok($$select * from public.metrics_daily_sales('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03')$$::text,'42501',null::text,'anon: daily_sales denegada');
select throws_ok($$select * from public.metrics_by_product('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03')$$::text,'42501',null::text,'anon: by_product denegada');
select throws_ok($$select * from public.metrics_by_customer('10000000-0000-0000-0000-000000000001','2026-11-01','2026-11-03','2026-10-01','2026-10-03')$$::text,'42501',null::text,'anon: by_customer denegada');
reset role;
select * from finish();
rollback;
