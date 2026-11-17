begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

insert into auth.users(id, email) values ('41000000-0000-0000-0000-000000000003', 'inventory-cash@test.invalid');
insert into public.organizations(id, name, slug) values
  ('41000000-0000-0000-0000-000000000001', 'A', 'inventory-cash-a'),
  ('41000000-0000-0000-0000-000000000002', 'B', 'inventory-cash-b');
insert into public.memberships(organization_id, user_id, role) values ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000003', 'owner');

insert into public.products(id, organization_id, sku, name, standard_cost) values
  ('41000000-0000-0000-0000-000000000011', '41000000-0000-0000-0000-000000000001', 'P1', 'Con costo de snapshot', 9),
  ('41000000-0000-0000-0000-000000000012', '41000000-0000-0000-0000-000000000001', 'P2', 'Con costo estándar', 1.2345),
  ('41000000-0000-0000-0000-000000000013', '41000000-0000-0000-0000-000000000001', 'P3', 'Sin costo', null),
  ('41000000-0000-0000-0000-000000000014', '41000000-0000-0000-0000-000000000001', 'P4', 'Ausente en el último corte', 1),
  ('41000000-0000-0000-0000-000000000015', '41000000-0000-0000-0000-000000000001', 'P5', 'Sin existencia', 1),
  ('41000000-0000-0000-0000-000000000016', '41000000-0000-0000-0000-000000000002', 'PB', 'Producto B', 1);
insert into public.inventory_snapshots(organization_id, product_id, snapshot_on, quantity, unit_cost) values
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000014', date '2026-11-18' - 3, 7, 1),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000011', date '2026-11-18' - 1, 3, 2),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000012', date '2026-11-18' - 1, 2, null),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000013', date '2026-11-18' - 1, 1, null),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000015', date '2026-11-18' - 1, 0, 1),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000011', date '2026-11-18' + 1, 99, 99),
  ('41000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000016', date '2026-11-18' - 0, 2, 1);

insert into public.customers(id, organization_id, code, name, credit_limit) values
  ('41000000-0000-0000-0000-000000000021', '41000000-0000-0000-0000-000000000001', 'C1', 'Cliente 1', null),
  ('41000000-0000-0000-0000-000000000022', '41000000-0000-0000-0000-000000000001', 'C2', 'Cliente 2', 100),
  ('41000000-0000-0000-0000-000000000023', '41000000-0000-0000-0000-000000000001', 'C3', 'Cliente 3', null),
  ('41000000-0000-0000-0000-000000000024', '41000000-0000-0000-0000-000000000001', 'C4', 'Cliente 4', 59.99),
  ('41000000-0000-0000-0000-000000000025', '41000000-0000-0000-0000-000000000001', 'C5', 'Cliente 5', 0),
  ('41000000-0000-0000-0000-000000000026', '41000000-0000-0000-0000-000000000001', 'C6', 'Cliente 6', 80),
  ('41000000-0000-0000-0000-000000000027', '41000000-0000-0000-0000-000000000001', 'C7', 'Cliente 7', 100),
  ('41000000-0000-0000-0000-000000000028', '41000000-0000-0000-0000-000000000002', 'C8', 'Cliente 8', 100);
insert into public.sales(id, organization_id, external_ref, customer_id, sold_on, status, subtotal, tax, total) values
  ('41000000-0000-0000-0000-000000000031', '41000000-0000-0000-0000-000000000001', 'S31', '41000000-0000-0000-0000-000000000021', date '2026-11-18' - 89, 'completed', 1, 0, 1),
  ('41000000-0000-0000-0000-000000000032', '41000000-0000-0000-0000-000000000001', 'S32', '41000000-0000-0000-0000-000000000021', date '2026-11-18' - 90, 'completed', 1, 0, 1),
  ('41000000-0000-0000-0000-000000000033', '41000000-0000-0000-0000-000000000001', 'S33', '41000000-0000-0000-0000-000000000021', date '2026-11-18' - 0, 'cancelled', 1, 0, 1),
  ('41000000-0000-0000-0000-000000000034', '41000000-0000-0000-0000-000000000001', 'S34', '41000000-0000-0000-0000-000000000021', date '2026-11-18' - 0, 'completed', 1, 0, 1),
  ('41000000-0000-0000-0000-000000000035', '41000000-0000-0000-0000-000000000001', 'S35', '41000000-0000-0000-0000-000000000021', date '2026-11-18' + 1, 'completed', 1, 0, 1);
insert into public.sale_lines(organization_id, sale_id, product_id, quantity, unit_price, unit_cost, line_total) values
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000031', '41000000-0000-0000-0000-000000000011', 1.333, 1, 0.1, 1),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000031', '41000000-0000-0000-0000-000000000011', 1, 1, null, 1),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000032', '41000000-0000-0000-0000-000000000012', 1, 1, 1, 1),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000033', '41000000-0000-0000-0000-000000000012', 1, 1, 1, 1),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000034', '41000000-0000-0000-0000-000000000014', 1, 1, 0.1234, 1),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000035', '41000000-0000-0000-0000-000000000012', 1, 1, 1, 1);

insert into public.receivables(organization_id, customer_id, external_ref, issued_on, due_on, amount, paid_amount) values
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000021', 'R1', date '2026-11-18' - 100, date '2026-11-18' - 0, 10, 0),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000021', 'R2', date '2026-11-18' - 100, date '2026-11-18' - 30, 25, 5),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000022', 'R3', date '2026-11-18' - 100, date '2026-11-18' - 31, 30, 0),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000022', 'R4', date '2026-11-18' - 100, date '2026-11-18' - 90, 40, 0),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000023', 'R5', date '2026-11-18' - 100, date '2026-11-18' - 91, 50, 0),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000024', 'R6', date '2026-11-18' - 100, date '2026-11-18' - 0, 60, 0),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000025', 'R7', date '2026-11-18' - 100, date '2026-11-18' - 0, 70, 0),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000026', 'R8', date '2026-11-18' - 100, date '2026-11-18' + 5, 80, 0),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000027', 'R9', date '2026-11-18' - 100, date '2026-11-18' - 91, 100, 100),
  ('41000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000027', 'R10', date '2026-11-18' + 1, date '2026-11-18' + 8, 100, 0),
  ('41000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000028', 'R11', date '2026-11-18' - 100, date '2026-11-18' - 31, 500, 0);

set local role authenticated;
set local request.jwt.claims = '{"sub":"41000000-0000-0000-0000-000000000003","role":"authenticated"}';

select results_eq(
  $$select * from public.inventory_summary('41000000-0000-0000-0000-000000000001', '2026-11-18')$$::text,
  $$values (date '2026-11-18' - 1, 8.47::numeric, 66.7::numeric, .26::numeric, 2969.6::numeric, .1::numeric, 2.47::numeric, 29.2::numeric, 2::bigint, 3::bigint)$$::text,
  'Inventario: corte global, cobertura, costo exacto, días y rotación'
);
select results_eq(
  $$select sku, quantity, unit_cost, inventory_value, cogs_90d, days_on_hand, last_sold_on, days_since_sale, is_stale
    from public.inventory_by_product('41000000-0000-0000-0000-000000000001', '2026-11-18') order by sku$$::text,
  $$values ('P1'::text, 3::numeric, 2::numeric, 6::numeric, .13::numeric, 4051.0::numeric, date '2026-11-18' - 89, 89, false),
         ('P2', 2, 1.2345, 2.47, 0, null, date '2026-11-18' - 90, 90, true),
         ('P3', 1, null, null, 0, null, null, null, true)$$::text,
  'Productos: bordes 90 y 91, costo estándar, venta cancelada y producto nunca vendido'
);
select results_eq(
  $$select * from public.receivables_summary('41000000-0000-0000-0000-000000000001', '2026-11-18')$$::text,
  $$values (360::numeric, 140::numeric, 38.9::numeric, 220::numeric, 20::numeric, 30::numeric, 40::numeric, 50::numeric, 6::bigint, 91.7::numeric)$$::text,
  'Cobranza: saldo parcial, tramos y concentración de cinco entre seis'
);
select results_eq(
  $$select code, open_balance, overdue_balance, current_balance, d1_30, d31_60, d61_90, d90_plus,
    max_days_overdue, credit_limit, credit_used_pct, share_pct, risk
    from public.receivables_by_customer('41000000-0000-0000-0000-000000000001', '2026-11-18') order by code$$::text,
  $$values ('C1'::text, 30::numeric, 20::numeric, 10::numeric, 20::numeric, 0::numeric, 0::numeric, 0::numeric, 30, null::numeric, null::numeric, 8.3::numeric, 'bajo'::text),
         ('C2', 70, 70, 0, 0, 30, 40, 0, 90, 100, 70.0, 19.4, 'medio'),
         ('C3', 50, 50, 0, 0, 0, 0, 50, 91, null, null, 13.9, 'alto'),
         ('C4', 60, 0, 60, 0, 0, 0, 0, 0, 59.99, 100.0, 16.7, 'alto'),
         ('C5', 70, 0, 70, 0, 0, 0, 0, 0, 0, null, 19.4, 'bajo'),
         ('C6', 80, 0, 80, 0, 0, 0, 0, 0, 80, 100.0, 22.2, 'bajo')$$::text,
  'Clientes: límites nulo y cero, riesgo y porcentajes exactos'
);
select results_eq(
  $$select * from public.inventory_summary('41000000-0000-0000-0000-000000000001', '2025-01-01')$$::text,
  $$values (null::date, 0::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::bigint, 0::bigint)$$::text,
  'A sin datos al corte: resumen de inventario'
);
select results_eq(
  $$select * from public.receivables_summary('41000000-0000-0000-0000-000000000001', '2025-01-01')$$::text,
  $$values (0::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::bigint, null::numeric)$$::text,
  'A sin datos al corte: resumen de cobranza'
);
select is_empty($$select * from public.inventory_by_product('41000000-0000-0000-0000-000000000001', '2025-01-01')$$::text, 'A sin datos al corte: inventory_by_product vacío');
select is_empty($$select * from public.receivables_by_customer('41000000-0000-0000-0000-000000000001', '2025-01-01')$$::text, 'A sin datos al corte: receivables_by_customer vacío');
select results_eq(
  $$select * from public.inventory_summary('41000000-0000-0000-0000-000000000002', '2026-11-18')$$::text,
  $$values (null::date, 0::numeric, null::numeric, 0::numeric, null::numeric, null::numeric, 0::numeric, null::numeric, 0::bigint, 0::bigint)$$::text,
  'B oculta por RLS: resumen de inventario'
);
select results_eq(
  $$select * from public.receivables_summary('41000000-0000-0000-0000-000000000002', '2026-11-18')$$::text,
  $$values (0::numeric, 0::numeric, null::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::bigint, null::numeric)$$::text,
  'B oculta por RLS: resumen de cobranza'
);
select is_empty($$select * from public.inventory_by_product('41000000-0000-0000-0000-000000000002', '2026-11-18')$$::text, 'B oculta por RLS: inventory_by_product vacío');
select is_empty($$select * from public.receivables_by_customer('41000000-0000-0000-0000-000000000002', '2026-11-18')$$::text, 'B oculta por RLS: receivables_by_customer vacío');
reset role;
set local role anon;
select throws_ok($$select * from public.inventory_summary('41000000-0000-0000-0000-000000000001', '2026-11-18')$$::text, '42501', null::text, 'anon: inventory_summary denegada');
select throws_ok($$select * from public.inventory_by_product('41000000-0000-0000-0000-000000000001', '2026-11-18')$$::text, '42501', null::text, 'anon: inventory_by_product denegada');
select throws_ok($$select * from public.receivables_summary('41000000-0000-0000-0000-000000000001', '2026-11-18')$$::text, '42501', null::text, 'anon: receivables_summary denegada');
select throws_ok($$select * from public.receivables_by_customer('41000000-0000-0000-0000-000000000001', '2026-11-18')$$::text, '42501', null::text, 'anon: receivables_by_customer denegada');
reset role;
select * from finish();
rollback;
