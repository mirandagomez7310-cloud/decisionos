begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(26);

insert into public.organizations(id, name, slug) values
  ('51000000-0000-0000-0000-000000000001', 'A', 'insights-a'),
  ('51000000-0000-0000-0000-000000000002', 'B', 'insights-b');
insert into auth.users(id, email) values
  ('51000000-0000-0000-0000-000000000003', 'insights-analyst@test.invalid'),
  ('51000000-0000-0000-0000-000000000004', 'insights-viewer@test.invalid');
insert into public.memberships(organization_id, user_id, role) values
  ('51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000003', 'analyst'),
  ('51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000004', 'viewer');

insert into public.products(id, organization_id, sku, name) values
  ('51000000-0000-0000-0000-000000000011', '51000000-0000-0000-0000-000000000001', 'P1', 'Actual 1'),
  ('51000000-0000-0000-0000-000000000012', '51000000-0000-0000-0000-000000000001', 'P2', 'Actual 2'),
  ('51000000-0000-0000-0000-000000000013', '51000000-0000-0000-0000-000000000001', 'P3', 'Sin costo'),
  ('51000000-0000-0000-0000-000000000014', '51000000-0000-0000-0000-000000000001', 'P4', 'Sin movimiento'),
  ('51000000-0000-0000-0000-000000000015', '51000000-0000-0000-0000-000000000002', 'P5', 'Primera venta de B');
insert into public.customers(id, organization_id, code, name)
select ('51000000-0000-0000-0000-' || lpad((20 + n)::text, 12, '0'))::uuid,
  '51000000-0000-0000-0000-000000000001', 'C' || n, 'Cliente ' || n
from generate_series(1, 10) n;
insert into public.customers(id, organization_id, code, name) values
  ('51000000-0000-0000-0000-000000000031', '51000000-0000-0000-0000-000000000002', 'C1', 'Cliente de B');

insert into public.sales(id, organization_id, external_ref, customer_id, sold_on, status, subtotal, tax, total) values
  ('51000000-0000-0000-0000-000000000041', '51000000-0000-0000-0000-000000000001', 'S1', '51000000-0000-0000-0000-000000000021', date '2026-11-18' - 49, 'completed', 1000, 0, 1000),
  ('51000000-0000-0000-0000-000000000042', '51000000-0000-0000-0000-000000000001', 'S2', '51000000-0000-0000-0000-000000000021', date '2026-11-18' - 18, 'completed', 800, 0, 800);
insert into public.sale_lines(organization_id, sale_id, product_id, quantity, unit_price, unit_cost, line_total) values
  ('51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000041', '51000000-0000-0000-0000-000000000011', 1, 1000, 1000, 1000),
  ('51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000042', '51000000-0000-0000-0000-000000000011', 1, 300, 320, 300),
  ('51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000042', '51000000-0000-0000-0000-000000000012', 1, 300, 340, 300),
  ('51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000042', '51000000-0000-0000-0000-000000000013', 1, 200, null, 200);
insert into public.inventory_snapshots(organization_id, product_id, snapshot_on, quantity, unit_cost) values
  ('51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000011', date '2026-11-18' - 1, 1, 70),
  ('51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000014', date '2026-11-18' - 1, 1, 30);
insert into public.receivables(organization_id, customer_id, external_ref, issued_on, due_on, amount)
select organization_id, id, code, date '2026-11-18' - 100,
  date '2026-11-18' - case when code in ('C1', 'C2') then 91 when code = 'C3' then 1 else 0 end,
  case code when 'C1' then 150 when 'C2' then 200 else 100 end
from public.customers where organization_id = '51000000-0000-0000-0000-000000000001';

set local role service_role;
select results_eq(
  $$select rule_key, module, severity, period_start, period_end, metric_snapshot
    from public.evaluate_insight_rules('51000000-0000-0000-0000-000000000001', date '2026-11-18') order by rule_key$$::text,
  $$select r.rule_key, r.module, r.severity,
      case when r.closed then date '2026-10-01' else date '2026-11-01' end,
      case when r.closed then date '2026-10-31' else date '2026-11-18' end,
      r.snapshot::jsonb
    from (values
      ('high_risk_customers', 'cash', 'critical', false, '{"overdue_balance":200,"risk":"alto"}'),
      ('low_cost_coverage', 'profit', 'info', true, '{"coverage":75,"margin_base":600,"net_sales":800}'),
      ('margin_drop', 'profit', 'warning', true, '{"margin_pct":-10,"prev_margin_pct":0,"margin_pct_change_pts":-10}'),
      ('negative_margin_products', 'profit', 'warning', true, '{"gross_margin":-40}'),
      ('overdue_share', 'cash', 'warning', false, '{"overdue_pct":39.1,"overdue_balance":450,"open_balance":1150}'),
      ('receivables_concentration', 'cash', 'info', false, '{"top5_share_pct":56.5,"open_balance":1150}'),
      ('sales_drop', 'sales', 'critical', true, '{"net_sales":800,"prev_net_sales":1000,"net_sales_change_pct":-20}'),
      ('stale_inventory', 'inventory', 'warning', false, '{"inventory_value":100,"stale_value":30,"stale_share_pct":30}')
    ) r(rule_key, module, severity, closed, snapshot) order by r.rule_key$$::text,
  'Las ocho reglas devuelven módulo, severidad, periodo y métricas exactas'
);
select is((select evidence from public.evaluate_insight_rules('51000000-0000-0000-0000-000000000001', date '2026-11-18') where rule_key = 'negative_margin_products'),
  jsonb_build_object('metric', 'metrics_by_product', 'from', '2026-10-01', 'to', '2026-10-31',
    'prev_from', '2026-09-01', 'prev_to', '2026-09-30', 'count', 2, 'ids', jsonb_build_array('51000000-0000-0000-0000-000000000012'::text, '51000000-0000-0000-0000-000000000011'::text)),
  'Productos ordenados por margen ascendente con total y periodo comparado');
select is((select evidence from public.evaluate_insight_rules('51000000-0000-0000-0000-000000000001', date '2026-11-18') where rule_key = 'high_risk_customers'),
  jsonb_build_object('metric', 'receivables_by_customer', 'from', '2026-11-01', 'to', '2026-11-18',
    'prev_from', null::date, 'prev_to', null::date, 'count', 2, 'ids', jsonb_build_array('51000000-0000-0000-0000-000000000022'::text, '51000000-0000-0000-0000-000000000021'::text)),
  'Clientes ordenados por saldo vencido descendente con total y corte');
select is_empty($$select * from public.evaluate_insight_rules('51000000-0000-0000-0000-000000000002', date '2026-11-18')$$::text, 'B sin datos: cero reglas');
reset role;

update public.sale_lines set line_total = 360, unit_cost = 370.80
where sale_id = '51000000-0000-0000-0000-000000000042' and unit_cost is not null;
update public.sale_lines set line_total = 180 where sale_id = '51000000-0000-0000-0000-000000000042' and unit_cost is null;
update public.inventory_snapshots set unit_cost = case when product_id = '51000000-0000-0000-0000-000000000014' then 20 else 80 end
where organization_id = '51000000-0000-0000-0000-000000000001';
update public.receivables set amount = 100 where organization_id = '51000000-0000-0000-0000-000000000001';

set local role service_role;
select results_eq(
  $$select rule_key, severity, metric_snapshot from public.evaluate_insight_rules('51000000-0000-0000-0000-000000000001', date '2026-11-18')
    where rule_key in ('sales_drop', 'margin_drop') order by rule_key$$::text,
  $$values ('margin_drop'::text, 'warning'::text, '{"margin_pct":-3,"prev_margin_pct":0,"margin_pct_change_pts":-3}'::jsonb),
    ('sales_drop', 'warning', '{"net_sales":900,"prev_net_sales":1000,"net_sales_change_pct":-10}'::jsonb)$$::text,
  'Ventas en -10 % y margen en -3 puntos sí disparan'
);
select is_empty(
  $$select * from public.evaluate_insight_rules('51000000-0000-0000-0000-000000000001', date '2026-11-18')
    where rule_key in ('low_cost_coverage', 'stale_inventory', 'receivables_concentration', 'overdue_share')$$::text,
  'Los límites exactos 80 %, 20 %, 50 % y 30 % quedan fuera'
);
reset role;

update public.sale_lines set unit_cost = 370.44 where sale_id = '51000000-0000-0000-0000-000000000042' and unit_cost is not null;
update public.sale_lines set line_total = 181 where sale_id = '51000000-0000-0000-0000-000000000042' and unit_cost is null;
insert into public.sales(id, organization_id, external_ref, customer_id, sold_on, status, subtotal, tax, total) values
  ('51000000-0000-0000-0000-000000000043', '51000000-0000-0000-0000-000000000002', 'S3', '51000000-0000-0000-0000-000000000031', date '2026-11-18' - 18, 'completed', 100, 0, 100);
insert into public.sale_lines(organization_id, sale_id, product_id, quantity, unit_price, unit_cost, line_total) values
  ('51000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000043', '51000000-0000-0000-0000-000000000015', 1, 100, 75, 100);

set local role service_role;
select is_empty(
  $$select * from public.evaluate_insight_rules('51000000-0000-0000-0000-000000000001', date '2026-11-18') where rule_key in ('sales_drop', 'margin_drop')$$::text,
  'Ventas en -9,9 % y margen en -2,9 puntos quedan fuera'
);
select is_empty(
  $$select * from public.evaluate_insight_rules('51000000-0000-0000-0000-000000000002', date '2026-11-18') where rule_key = 'sales_drop'$$::text,
  'B tiene venta en el mes cerrado y ninguna en el mes comparado'
);
select is(public.enqueue_daily_insights(), 2, 'Encola un job por cada organización con datos');
select results_eq(
  $$select organization_id, kind, status, payload from public.jobs
    where organization_id in ('51000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002') order by organization_id$$::text,
  $$values ('51000000-0000-0000-0000-000000000001'::uuid, 'compute_insights'::text, 'queued'::text, '{}'::jsonb),
    ('51000000-0000-0000-0000-000000000002'::uuid, 'compute_insights', 'queued', '{}')$$::text,
  'Cada organización tiene un job compute_insights con payload vacío'
);
update public.jobs set status = 'running' where organization_id = '51000000-0000-0000-0000-000000000001' and kind = 'compute_insights';
select is(public.enqueue_daily_insights(), 0, 'No duplica jobs activos en cola o en ejecución');
update public.jobs set status = 'done' where organization_id = '51000000-0000-0000-0000-000000000002' and kind = 'compute_insights';
select is(public.enqueue_insights('51000000-0000-0000-0000-000000000002'), true, 'Encola el cálculo para la organización');
select is(public.enqueue_insights('51000000-0000-0000-0000-000000000002'), false, 'No duplica un cálculo en cola');
reset role;

insert into public.insights(id, organization_id, module, kind, severity, title, body, evidence,
  metric_snapshot, period_start, period_end, generated_by, rule_key) values
  ('51000000-0000-0000-0000-000000000051', '51000000-0000-0000-0000-000000000001', 'sales', 'fact', 'warning', 'Título', 'Cuerpo', '{}', '{}', date '2026-11-18' - 48, date '2026-11-18' - 18, 'rule', 'sales_drop'),
  ('51000000-0000-0000-0000-000000000052', '51000000-0000-0000-0000-000000000002', 'sales', 'fact', 'warning', 'Título', 'Cuerpo', '{}', '{}', date '2026-11-18' - 48, date '2026-11-18' - 18, 'rule', 'sales_drop');
select throws_ok($$insert into public.insights(id, organization_id, module, kind, severity, title, body, evidence,
  metric_snapshot, period_start, period_end, generated_by, rule_key) values ('51000000-0000-0000-0000-000000000053', '51000000-0000-0000-0000-000000000001', 'sales', 'fact', 'warning', 'Título', 'Cuerpo', '{}', '{}', date '2026-11-18' - 48, date '2026-11-18' - 18, 'llm', null)$$::text, '23514', null::text, 'Un hecho requiere una regla');
select throws_ok($$insert into public.insights(id, organization_id, module, kind, severity, title, body, evidence,
  metric_snapshot, period_start, period_end, generated_by, rule_key) values ('51000000-0000-0000-0000-000000000054', '51000000-0000-0000-0000-000000000001', 'sales', 'fact', 'warning', 'Título', 'Cuerpo', '{}', '{}', date '2026-11-18' - 48, date '2026-11-18' - 18, 'rule', 'sales_drop')$$::text, '23505', null::text, 'Una regla no se duplica en la misma organización y mes');

set local role authenticated;
set local request.jwt.claims = '{"sub":"51000000-0000-0000-0000-000000000003","role":"authenticated"}';
select results_eq($$select id from public.insights$$::text, $$values ('51000000-0000-0000-0000-000000000051'::uuid)$$::text,
  'El analyst de A solo ve los insights de su organización');
select throws_ok($$select * from public.evaluate_insight_rules('51000000-0000-0000-0000-000000000001', date '2026-11-18')$$::text, '42501', null::text, 'authenticated no puede evaluar reglas');
select throws_ok($$select public.enqueue_daily_insights()$$::text, '42501', null::text, 'authenticated no puede encolar el cálculo diario');
select throws_ok($$select public.enqueue_insights('51000000-0000-0000-0000-000000000001')$$::text, '42501', null::text, 'authenticated no puede encolar el cálculo de su organización');
select is((public.set_insight_status('51000000-0000-0000-0000-000000000051', 'seen')).status, 'seen', 'El analyst cambia el estado');
select throws_ok($$select public.set_insight_status('51000000-0000-0000-0000-000000000052', 'seen')$$::text, '42501', null::text, 'El analyst no puede cambiar un insight de B');
select throws_ok($$select public.set_insight_status('51000000-0000-0000-0000-000000000051', 'invalid')$$::text, '22023', null::text, 'Se rechaza un estado inválido');
select throws_ok($$select public.set_insight_status('51000000-0000-0000-0000-000000000051', null)$$::text, '22023', null::text, 'Se rechaza un estado nulo');
set local request.jwt.claims = '{"sub":"51000000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok($$select public.set_insight_status('51000000-0000-0000-0000-000000000051', 'done')$$::text, '42501', null::text, 'El viewer no puede cambiar el estado');
reset role;

select results_eq(
  $$select organization_id, actor_user_id, actor_kind, action, entity, entity_id, data from public.audit_log
    where entity = 'insights' and entity_id in ('51000000-0000-0000-0000-000000000051', '51000000-0000-0000-0000-000000000052')$$::text,
  $$values ('51000000-0000-0000-0000-000000000001'::uuid, '51000000-0000-0000-0000-000000000003'::uuid, 'user'::text,
    'insights.status_changed'::text, 'insights'::text, '51000000-0000-0000-0000-000000000051'::text, '{"old":"new","new":"seen"}'::jsonb)$$::text,
  'Solo el cambio autorizado deja una entrada de auditoría con actor y estados'
);
set local role anon;
select throws_ok($$select * from public.insights$$::text, '42501', null::text, 'anon no puede leer insights');
reset role;

select * from finish();
rollback;
