begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(47);

insert into auth.users(id, email) values
  ('00000001-0000-0000-0000-000000000001', 'rpc@test.invalid');
insert into public.organizations(id, name, slug) values
  ('00000100-0000-0000-0000-000000000001', 'A', 'rpc-a'),
  ('00000101-0000-0000-0000-000000000001', 'B', 'rpc-b');
insert into public.imports(id, organization_id, kind, storage_path, original_filename, created_by) values
  ('00000700-0000-0000-0000-000000000001', '00000100-0000-0000-0000-000000000001', 'sales', '00000100-0000-0000-0000-000000000001/00000700-0000-0000-0000-000000000001-a.csv', 'a.csv', '00000001-0000-0000-0000-000000000001'),
  ('00000701-0000-0000-0000-000000000001', '00000100-0000-0000-0000-000000000001', 'sales', '00000100-0000-0000-0000-000000000001/00000701-0000-0000-0000-000000000001-b.csv', 'b.csv', '00000001-0000-0000-0000-000000000001');

select is((select preview from public.imports where id = '00000700-0000-0000-0000-000000000001'), '[]'::jsonb, 'preview vacío por defecto');
select throws_ok($$update public.imports set storage_path = '00000100-0000-0000-0000-000000000001/../00000101-0000-0000-0000-000000000001/x.csv' where id = '00000700-0000-0000-0000-000000000001'$$, '23514', null::text, 'rechaza traversal');
select throws_ok($$update public.imports set storage_path = '00000100-0000-0000-0000-000000000001/sub/x.csv' where id = '00000700-0000-0000-0000-000000000001'$$, '23514', null::text, 'rechaza subcarpetas');
select lives_ok($$update public.imports set storage_path = '00000100-0000-0000-0000-000000000001/00000700-0000-0000-0000-000000000001-x.csv' where id = '00000700-0000-0000-0000-000000000001'$$, 'acepta UUID y nombre');

set local role authenticated;
select throws_ok($$select public.apply_import_sales('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[]')$$, '42501', null::text, 'authenticated: no ejecuta ventas');
select throws_ok($$select public.apply_import_products('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[]')$$, '42501', null::text, 'authenticated: no ejecuta productos');
select throws_ok($$select public.apply_import_customers('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[]')$$, '42501', null::text, 'authenticated: no ejecuta clientes');
select throws_ok($$select public.apply_import_inventory('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[]')$$, '42501', null::text, 'authenticated: no ejecuta inventario');
select throws_ok($$select public.apply_import_receivables('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[]')$$, '42501', null::text, 'authenticated: no ejecuta cuentas');
select throws_ok($$select public.revert_import('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001')$$, '42501', null::text, 'authenticated: no ejecuta reversión');
reset role;

create temporary table payload(rows jsonb);
insert into payload values ('[
  {"row_number":1,"external_ref":"F1","sold_on":"2026-11-01","customer_code":"C1","customer_name":"Cliente nuevo","product_sku":"P1","product_name":"Producto nuevo","quantity":"1.000","unit_price":"0.1000","discount":"0.00","line_total":"0.10","status":"completed","currency":"MXN","tax":"0.05"},
  {"row_number":2,"external_ref":"F1","sold_on":"2026-11-01","customer_code":"C1","product_sku":"P1","quantity":"1.000","unit_price":"0.2000","discount":"0.00","line_total":"0.20","status":"completed","currency":"MXN","tax":"0.05"},
  {"row_number":3,"external_ref":"F2","sold_on":"2026-11-02","customer_code":"C1","product_sku":"P1","quantity":"2.000","unit_price":"1.5000","discount":"0.00","line_total":"3.00","status":"completed","currency":"MXN","tax":"0.00"}
]');
grant select on payload to service_role;
set local role service_role;
select results_eq(
  $$select inserted_sales, inserted_lines, rejected from public.apply_import_sales('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', (select rows from payload))$$,
  $$values (2, 3, '[]'::jsonb)$$,
  'service_role importa dos folios y tres líneas en conjunto');
reset role;
select is((select count(*) from public.customers where code = 'C1'), 1::bigint, 'crea un cliente nuevo sin duplicarlo');
select is((select name from public.customers where code = 'C1'), 'Cliente nuevo', 'conserva nombre del cliente nuevo');
select is((select count(*) from public.products where sku = 'P1'), 1::bigint, 'crea un producto nuevo sin duplicarlo');
select is((select name from public.products where sku = 'P1'), 'Producto nuevo', 'conserva nombre del producto nuevo');
select results_eq($$select external_ref, subtotal, tax, total from public.sales order by external_ref$$, $$values ('F1'::text, 0.30::numeric, 0.05::numeric, 0.35::numeric), ('F2', 3.00, 0.00, 3.00)$$, 'suma dinero exactamente y aplica impuesto una vez por folio');
select is((select count(*) from public.sales where source_import_id = '00000700-0000-0000-0000-000000000001'), 2::bigint, 'atribuye las ventas al import');

update payload set rows = jsonb_build_array(rows->0);
set local role service_role;
select results_eq(
  $$select inserted_sales, inserted_lines from public.apply_import_sales('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', (select rows from payload))$$,
  $$values (1, 1)$$,
  'reimporta el folio con una línea');
reset role;
select is((select count(*) from public.sale_lines l join public.sales s on s.id = l.sale_id where s.external_ref = 'F1'), 1::bigint, 'reimportar reemplaza líneas sin duplicarlas');
select is((select total from public.sales where external_ref = 'F1'), 0.15::numeric, 'reimportar recalcula el total');
select is((select count(*) from public.sale_lines l join public.sales s on s.id = l.sale_id where s.external_ref = 'F2'), 1::bigint, 'reimportar F1 conserva F2');

update payload set rows = jsonb_build_array(((rows->0) - 'product_name') || '{"row_number":9,"external_ref":"REJECTED","product_sku":"UNKNOWN"}'::jsonb);
set local role service_role;
select results_eq(
  $$select inserted_sales, inserted_lines, rejected->0->>'external_ref', (rejected->0->>'row_number')::int, rejected->0->>'motivo' from public.apply_import_sales('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', (select rows from payload))$$,
  $$values (0, 0, 'REJECTED'::text, 9, 'Producto desconocido sin nombre'::text)$$,
  'producto desconocido sin nombre vuelve en rejected con fila y motivo');
reset role;
select is_empty($$select * from public.sales where external_ref = 'REJECTED'$$, 'no crea cabecera rechazada');

set local role service_role;
select throws_ok($$select public.apply_import_sales('00000101-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[]')$$, '42501', null::text, 'ventas: exige organización del import');
select throws_ok($$select public.apply_import_products('00000101-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[]')$$, '42501', null::text, 'productos: exige organización del import');
select throws_ok($$select public.apply_import_customers('00000101-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[]')$$, '42501', null::text, 'clientes: exige organización del import');
select throws_ok($$select public.apply_import_inventory('00000101-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[]')$$, '42501', null::text, 'inventario: exige organización del import');
select throws_ok($$select public.apply_import_receivables('00000101-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[]')$$, '42501', null::text, 'cuentas: exige organización del import');
select throws_ok($$select public.revert_import('00000101-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001')$$, '42501', null::text, 'reversión: exige organización del import');

select lives_ok($$select public.apply_import_products('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[{"sku":"P1","name":"Renombrado","category":"Cat","active":false,"list_price":"12.3456"}]')$$, 'upsert de catálogo de productos');
select lives_ok($$select public.apply_import_products('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[{"sku":"P1","name":"Renombrado otra vez"}]')$$, 'producto admite celdas opcionales vacías');
select lives_ok($$select public.apply_import_customers('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[{"code":"C1","name":"Cliente actualizado","segment":"S","active":false,"credit_limit":"50.00"}]')$$, 'upsert de catálogo de clientes');
select lives_ok($$select public.apply_import_customers('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[{"code":"C1","name":"Cliente final"}]')$$, 'cliente admite celdas opcionales vacías');
select lives_ok($$select public.apply_import_inventory('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[{"row_number":1,"product_sku":"P1","snapshot_on":"2026-11-01","quantity":"2.000","unit_cost":"0.1000"}]')$$, 'inserta inventario por SKU');
select lives_ok($$select public.apply_import_receivables('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', '[{"row_number":1,"external_ref":"R1","customer_code":"C1","sale_external_ref":"F1","issued_on":"2026-11-01","due_on":"2026-12-01","amount":"10.00","paid_amount":"2.00"}]')$$, 'inserta cuenta resolviendo venta y cliente');
reset role;
select results_eq($$select name, category, active, list_price from public.products where sku = 'P1'$$, $$values ('Renombrado otra vez'::text, 'Cat'::text, false, 12.3456::numeric)$$, 'producto conserva opcionales y active cuando faltan');
select results_eq($$select name, segment, active, credit_limit from public.customers where code = 'C1'$$, $$values ('Cliente final'::text, 'S'::text, false, 50.00::numeric)$$, 'cliente conserva opcionales y active cuando faltan');
select is((select sale_id from public.receivables where external_ref = 'R1'), (select id from public.sales where external_ref = 'F1'), 'cuenta vinculada a venta del mismo tenant');

insert into public.sales(organization_id, external_ref, customer_id, sold_on, status, subtotal, tax, total, source_import_id)
select organization_id, 'OTHER', customer_id, sold_on, status, subtotal, tax, total, '00000701-0000-0000-0000-000000000001' from public.sales where external_ref = 'F1';
insert into public.sale_lines(organization_id, sale_id, product_id, quantity, unit_price, line_total)
select s.organization_id, s.id, p.id, 1, 1, 1 from public.sales s join public.products p on p.organization_id = s.organization_id where s.external_ref = 'OTHER';
insert into public.receivables(organization_id, external_ref, customer_id, sale_id, issued_on, due_on, amount, source_import_id)
select organization_id, 'OTHER-R', customer_id, id, sold_on, sold_on, 1, '00000701-0000-0000-0000-000000000001' from public.sales where external_ref = 'F1';
insert into public.import_rows(organization_id, import_id, row_number, raw, error) values
  ('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001', 9, '{}', 'rechazada');
set local role service_role;
select lives_ok($$select public.revert_import('00000100-0000-0000-0000-000000000001', '00000700-0000-0000-0000-000000000001')$$, 'revierte por RPC');
reset role;
select is_empty($$select * from public.sales where source_import_id = '00000700-0000-0000-0000-000000000001'$$, 'sin ventas del import revertido');
select is((select count(*) from public.sale_lines), 1::bigint, 'borra líneas revertidas y conserva las del otro import');
select is((select count(*) from public.sales where external_ref = 'OTHER' and source_import_id = '00000701-0000-0000-0000-000000000001'), 1::bigint, 'conserva ventas del otro import');
select is_empty($$select * from public.inventory_snapshots where source_import_id = '00000700-0000-0000-0000-000000000001'$$, 'borra inventario del import');
select is_empty($$select * from public.receivables where source_import_id = '00000700-0000-0000-0000-000000000001'$$, 'borra cuentas del import');
select results_eq($$select external_ref, sale_id from public.receivables$$, $$values ('OTHER-R'::text, null::uuid)$$, 'conserva cuenta de otro import y desvincula venta borrada');
select is_empty($$select * from public.import_rows where import_id = '00000700-0000-0000-0000-000000000001'$$, 'borra errores del import');
select is((select status from public.imports where id = '00000700-0000-0000-0000-000000000001'), 'reverted', 'marca import revertido');
select * from finish();
rollback;
