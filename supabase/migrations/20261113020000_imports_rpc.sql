alter table public.imports drop constraint imports_check;
alter table public.imports add constraint imports_storage_path_check
  check (storage_path ~ ('^' || organization_id::text || '/[0-9a-f-]{36}-[A-Za-z0-9._-]+$'));
alter table public.imports add column preview jsonb not null default '[]';

create function public.apply_import_sales(p_organization_id uuid, p_import_id uuid, p_rows jsonb)
returns table (inserted_sales int, inserted_lines int, rejected jsonb)
language plpgsql security definer set search_path = '' as $$
declare valid_rows jsonb;
begin
  perform 1 from public.imports where id = p_import_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Importación fuera de la organización' using errcode = '42501'; end if;

  if exists (
    select 1 from pg_catalog.jsonb_to_recordset(p_rows) as r(
      external_ref text, sold_on date, customer_code text, status text, currency text, tax numeric)
    group by external_ref
    having count(distinct (sold_on, customer_code, coalesce(status, 'completed'), currency, coalesce(tax, 0))) > 1
  ) then raise exception 'Cabecera inconsistente' using errcode = '22023'; end if;

  insert into public.customers (organization_id, code, name)
    select distinct on (customer_code) p_organization_id, customer_code, customer_name
    from pg_catalog.jsonb_to_recordset(p_rows) as r(customer_code text, customer_name text)
    where nullif(customer_name, '') is not null
    order by customer_code, customer_name
    on conflict (organization_id, code) do nothing;
  insert into public.products (organization_id, sku, name)
    select distinct on (product_sku) p_organization_id, product_sku, product_name
    from pg_catalog.jsonb_to_recordset(p_rows) as r(product_sku text, product_name text)
    where nullif(product_name, '') is not null
    order by product_sku, product_name
    on conflict (organization_id, sku) do nothing;

  select coalesce(pg_catalog.jsonb_agg(r.value || pg_catalog.jsonb_build_object(
      'customer_id', c.id, 'product_id', p.id)) filter (where c.id is not null and p.id is not null), '[]'),
    coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'external_ref', r.value->>'external_ref',
      'row_number', coalesce((r.value->>'row_number')::int, r.ordinality::int),
      'motivo', case when c.id is null then 'Cliente desconocido sin nombre' else 'Producto desconocido sin nombre' end
    )) filter (where c.id is null or p.id is null), '[]')
    into valid_rows, rejected
    from pg_catalog.jsonb_array_elements(p_rows) with ordinality as r(value, ordinality)
    left join public.customers c on c.organization_id = p_organization_id and c.code = r.value->>'customer_code'
    left join public.products p on p.organization_id = p_organization_id and p.sku = r.value->>'product_sku';

  insert into public.sales as s (organization_id, external_ref, customer_id, sold_on, status, currency, subtotal, tax, total, source_import_id)
    select p_organization_id, external_ref, customer_id, sold_on, coalesce(status, 'completed'), currency,
      sum(line_total), coalesce(tax, 0), sum(line_total) + coalesce(tax, 0), p_import_id
    from pg_catalog.jsonb_to_recordset(valid_rows) as r(
      external_ref text, customer_id uuid, sold_on date, status text, currency text, line_total numeric, tax numeric)
    group by external_ref, customer_id, sold_on, coalesce(status, 'completed'), currency, coalesce(tax, 0)
    on conflict (organization_id, external_ref) do update set
      customer_id = excluded.customer_id, sold_on = excluded.sold_on, status = excluded.status,
      currency = excluded.currency, subtotal = excluded.subtotal, tax = excluded.tax,
      total = excluded.total, source_import_id = excluded.source_import_id;
  get diagnostics inserted_sales = row_count;

  delete from public.sale_lines l where l.organization_id = p_organization_id and l.sale_id in (
    select s.id from public.sales s where s.organization_id = p_organization_id and s.external_ref in (
      select r.external_ref from pg_catalog.jsonb_to_recordset(valid_rows) as r(external_ref text)
    )
  );
  insert into public.sale_lines (organization_id, sale_id, product_id, quantity, unit_price, unit_cost, discount, line_total)
    select p_organization_id, s.id, r.product_id, r.quantity, r.unit_price, r.unit_cost, coalesce(r.discount, 0), r.line_total
    from pg_catalog.jsonb_to_recordset(valid_rows) as r(
      external_ref text, product_id uuid, quantity numeric, unit_price numeric, unit_cost numeric, discount numeric, line_total numeric)
    join public.sales s on s.organization_id = p_organization_id and s.external_ref = r.external_ref;
  get diagnostics inserted_lines = row_count;
  return next;
end;
$$;

create function public.apply_import_products(p_organization_id uuid, p_import_id uuid, p_rows jsonb)
returns table (inserted_products int, rejected jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.imports where id = p_import_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Importación fuera de la organización' using errcode = '42501'; end if;
  insert into public.products as p (organization_id, sku, name, category, unit, standard_cost, list_price, active)
    select p_organization_id, r.sku, r.name, r.category, r.unit, r.standard_cost, r.list_price, coalesce(r.active, existing.active, true)
    from (
      select sku, (array_agg(name order by row_number desc))[1] as name,
        (array_agg(category order by row_number desc) filter (where category is not null))[1] as category,
        (array_agg(unit order by row_number desc) filter (where unit is not null))[1] as unit,
        (array_agg(standard_cost order by row_number desc) filter (where standard_cost is not null))[1] as standard_cost,
        (array_agg(list_price order by row_number desc) filter (where list_price is not null))[1] as list_price,
        (array_agg(active order by row_number desc) filter (where active is not null))[1] as active
      from pg_catalog.jsonb_to_recordset(p_rows) as r(
        sku text, name text, category text, unit text, standard_cost numeric, list_price numeric, active bool, row_number int)
      group by sku
    ) r
    left join public.products existing on existing.organization_id = p_organization_id and existing.sku = r.sku
    on conflict (organization_id, sku) do update set
      name = excluded.name, category = coalesce(excluded.category, p.category), unit = coalesce(excluded.unit, p.unit),
      standard_cost = coalesce(excluded.standard_cost, p.standard_cost), list_price = coalesce(excluded.list_price, p.list_price),
      active = excluded.active;
  get diagnostics inserted_products = row_count;
  rejected := '[]';
  return next;
end;
$$;

create function public.apply_import_customers(p_organization_id uuid, p_import_id uuid, p_rows jsonb)
returns table (inserted_customers int, rejected jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.imports where id = p_import_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Importación fuera de la organización' using errcode = '42501'; end if;
  insert into public.customers as c (organization_id, code, name, segment, credit_limit, payment_terms_days, active)
    select p_organization_id, r.code, r.name, r.segment, r.credit_limit, r.payment_terms_days, coalesce(r.active, existing.active, true)
    from (
      select code, (array_agg(name order by row_number desc))[1] as name,
        (array_agg(segment order by row_number desc) filter (where segment is not null))[1] as segment,
        (array_agg(credit_limit order by row_number desc) filter (where credit_limit is not null))[1] as credit_limit,
        (array_agg(payment_terms_days order by row_number desc) filter (where payment_terms_days is not null))[1] as payment_terms_days,
        (array_agg(active order by row_number desc) filter (where active is not null))[1] as active
      from pg_catalog.jsonb_to_recordset(p_rows) as r(
        code text, name text, segment text, credit_limit numeric, payment_terms_days int, active bool, row_number int)
      group by code
    ) r
    left join public.customers existing on existing.organization_id = p_organization_id and existing.code = r.code
    on conflict (organization_id, code) do update set
      name = excluded.name, segment = coalesce(excluded.segment, c.segment), credit_limit = coalesce(excluded.credit_limit, c.credit_limit),
      payment_terms_days = coalesce(excluded.payment_terms_days, c.payment_terms_days), active = excluded.active;
  get diagnostics inserted_customers = row_count;
  rejected := '[]';
  return next;
end;
$$;

create function public.apply_import_inventory(p_organization_id uuid, p_import_id uuid, p_rows jsonb)
returns table (inserted_inventory int, rejected jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.imports where id = p_import_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Importación fuera de la organización' using errcode = '42501'; end if;
  insert into public.products (organization_id, sku, name)
    select distinct on (product_sku) p_organization_id, product_sku, product_name
    from pg_catalog.jsonb_to_recordset(p_rows) as r(product_sku text, product_name text)
    where nullif(product_name, '') is not null
    order by product_sku, product_name
    on conflict (organization_id, sku) do nothing;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'external_ref', r.value->>'external_ref', 'row_number', coalesce((r.value->>'row_number')::int, r.n::int),
      'motivo', 'Producto desconocido sin nombre')), '[]') into rejected
    from pg_catalog.jsonb_array_elements(p_rows) with ordinality r(value, n)
    left join public.products p on p.organization_id = p_organization_id and p.sku = r.value->>'product_sku'
    where p.id is null;
  insert into public.inventory_snapshots (organization_id, product_id, snapshot_on, quantity, unit_cost, source_import_id)
    select distinct on (p.id, r.snapshot_on) p_organization_id, p.id, r.snapshot_on, r.quantity, r.unit_cost, p_import_id
    from pg_catalog.jsonb_to_recordset(p_rows) as r(product_sku text, snapshot_on date, quantity numeric, unit_cost numeric, row_number int)
    join public.products p on p.organization_id = p_organization_id and p.sku = r.product_sku
    order by p.id, r.snapshot_on, r.row_number desc
    on conflict (organization_id, product_id, snapshot_on) do update set
      quantity = excluded.quantity, unit_cost = excluded.unit_cost, source_import_id = excluded.source_import_id;
  get diagnostics inserted_inventory = row_count;
  return next;
end;
$$;

create function public.apply_import_receivables(p_organization_id uuid, p_import_id uuid, p_rows jsonb)
returns table (inserted_receivables int, rejected jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.imports where id = p_import_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Importación fuera de la organización' using errcode = '42501'; end if;
  insert into public.customers (organization_id, code, name)
    select distinct on (customer_code) p_organization_id, customer_code, customer_name
    from pg_catalog.jsonb_to_recordset(p_rows) as r(customer_code text, customer_name text)
    where nullif(customer_name, '') is not null
    order by customer_code, customer_name
    on conflict (organization_id, code) do nothing;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'external_ref', r.value->>'external_ref', 'row_number', coalesce((r.value->>'row_number')::int, r.n::int),
      'motivo', 'Cliente desconocido sin nombre')), '[]') into rejected
    from pg_catalog.jsonb_array_elements(p_rows) with ordinality r(value, n)
    left join public.customers c on c.organization_id = p_organization_id and c.code = r.value->>'customer_code'
    where c.id is null;
  insert into public.receivables (organization_id, external_ref, customer_id, sale_id, issued_on, due_on, amount, paid_amount, source_import_id)
    select distinct on (r.external_ref) p_organization_id, r.external_ref, c.id, s.id, r.issued_on, r.due_on,
      r.amount, coalesce(r.paid_amount, 0), p_import_id
    from pg_catalog.jsonb_to_recordset(p_rows) as r(external_ref text, customer_code text, sale_external_ref text,
      issued_on date, due_on date, amount numeric, paid_amount numeric, row_number int)
    join public.customers c on c.organization_id = p_organization_id and c.code = r.customer_code
    left join public.sales s on s.organization_id = p_organization_id and s.external_ref = r.sale_external_ref
    order by r.external_ref, r.row_number desc
    on conflict (organization_id, external_ref) do update set
      customer_id = excluded.customer_id, sale_id = excluded.sale_id, issued_on = excluded.issued_on,
      due_on = excluded.due_on, amount = excluded.amount, paid_amount = excluded.paid_amount, source_import_id = excluded.source_import_id;
  get diagnostics inserted_receivables = row_count;
  return next;
end;
$$;

create function public.revert_import(p_organization_id uuid, p_import_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.imports where id = p_import_id and organization_id = p_organization_id for update;
  if not found then raise exception 'Importación fuera de la organización' using errcode = '42501'; end if;
  delete from public.sale_lines l where l.organization_id = p_organization_id and l.sale_id in (
    select s.id from public.sales s where s.organization_id = p_organization_id and s.source_import_id = p_import_id
  );
  -- Las cuentas de otra importación conservan su saldo aunque desaparezca la venta.
  update public.receivables r set sale_id = null where r.organization_id = p_organization_id and r.sale_id in (
    select s.id from public.sales s where s.organization_id = p_organization_id and s.source_import_id = p_import_id
  );
  delete from public.sales where organization_id = p_organization_id and source_import_id = p_import_id;
  delete from public.inventory_snapshots where organization_id = p_organization_id and source_import_id = p_import_id;
  delete from public.receivables where organization_id = p_organization_id and source_import_id = p_import_id;
  delete from public.import_rows where organization_id = p_organization_id and import_id = p_import_id;
  update public.imports set status = 'reverted', finished_at = pg_catalog.now()
    where organization_id = p_organization_id and id = p_import_id;
end;
$$;

revoke execute on function public.apply_import_sales(uuid, uuid, jsonb), public.apply_import_products(uuid, uuid, jsonb),
  public.apply_import_customers(uuid, uuid, jsonb), public.apply_import_inventory(uuid, uuid, jsonb),
  public.apply_import_receivables(uuid, uuid, jsonb), public.revert_import(uuid, uuid) from public, anon, authenticated;
grant execute on function public.apply_import_sales(uuid, uuid, jsonb), public.apply_import_products(uuid, uuid, jsonb),
  public.apply_import_customers(uuid, uuid, jsonb), public.apply_import_inventory(uuid, uuid, jsonb),
  public.apply_import_receivables(uuid, uuid, jsonb), public.revert_import(uuid, uuid) to service_role;
