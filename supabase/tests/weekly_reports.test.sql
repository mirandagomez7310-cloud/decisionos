begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

insert into public.organizations(id, name, slug)
select ('53000000-0000-0000-0000-00000000000' || n)::uuid, 'Organización ' || n, 'weekly-' || n
from generate_series(1, 4) n;

insert into public.customers(id, organization_id, code, name)
values
  ('53000000-0000-0000-0000-000000000011', '53000000-0000-0000-0000-000000000001', 'C1', 'Cliente'),
  ('53000000-0000-0000-0000-000000000013', '53000000-0000-0000-0000-000000000003', 'C1', 'Cliente');
insert into public.sales(organization_id, external_ref, customer_id, sold_on, status, subtotal, tax, total)
values ('53000000-0000-0000-0000-000000000001', 'S1', '53000000-0000-0000-0000-000000000011', current_date, 'completed', 100, 0, 100);
insert into public.products(id, organization_id, sku, name)
values ('53000000-0000-0000-0000-000000000012', '53000000-0000-0000-0000-000000000002', 'P1', 'Producto');
insert into public.inventory_snapshots(organization_id, product_id, snapshot_on, quantity, unit_cost)
values ('53000000-0000-0000-0000-000000000002', '53000000-0000-0000-0000-000000000012', current_date, 1, 100);
insert into public.receivables(organization_id, customer_id, external_ref, issued_on, due_on, amount)
values ('53000000-0000-0000-0000-000000000003', '53000000-0000-0000-0000-000000000013', 'R1', current_date - 10, current_date - 1, 100);

set local role service_role;
select is(public.enqueue_weekly_reports(), 3, 'Encola una vez por organización con datos');
select results_eq(
  $$select organization_id from public.jobs where kind = 'weekly_report' order by organization_id$$,
  $$values ('53000000-0000-0000-0000-000000000001'::uuid),
    ('53000000-0000-0000-0000-000000000002'::uuid),
    ('53000000-0000-0000-0000-000000000003'::uuid)$$,
  'Incluye ventas, inventario y cobranza y excluye la organización vacía');
select public.claim_job('weekly-test', array['weekly_report']);
select is(public.enqueue_weekly_reports(), 0, 'Deduplica jobs en cola y en ejecución');

set local role authenticated;
select throws_ok('select public.enqueue_weekly_reports()', '42501', null, 'authenticated no puede encolar informes');
reset role;
select * from finish();
rollback;
