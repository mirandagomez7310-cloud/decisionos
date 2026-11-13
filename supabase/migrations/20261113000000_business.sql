-- source_import_id queda sin FK hasta 0003_imports_jobs.

create table public.products (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku text not null,
  name text not null,
  category text,
  unit text,
  standard_cost numeric(14,4),
  list_price numeric(14,4),
  active bool not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (organization_id, sku),
  unique (organization_id, id)
);

create table public.customers (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  segment text,
  credit_limit numeric(14,2),
  payment_terms_days int,
  active bool not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (organization_id, code),
  unique (organization_id, id)
);

create table public.sales (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  external_ref text not null,
  customer_id uuid not null,
  sold_on date not null,
  status text not null check (status in ('completed', 'cancelled', 'returned')),
  currency char(3) not null default 'MXN',
  subtotal numeric(14,2) not null,
  tax numeric(14,2) not null,
  total numeric(14,2) not null,
  source_import_id uuid,
  created_at timestamptz not null default pg_catalog.now(),
  unique (organization_id, external_ref),
  unique (organization_id, id),
  foreign key (organization_id, customer_id) references public.customers(organization_id, id)
);

create table public.sale_lines (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null,
  product_id uuid not null,
  quantity numeric(14,3) not null check (quantity <> 0),
  unit_price numeric(14,4) not null check (unit_price >= 0),
  unit_cost numeric(14,4),
  discount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  foreign key (organization_id, sale_id) references public.sales(organization_id, id),
  foreign key (organization_id, product_id) references public.products(organization_id, id)
);

create table public.inventory_snapshots (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  snapshot_on date not null,
  quantity numeric(14,3) not null,
  unit_cost numeric(14,4),
  source_import_id uuid,
  primary key (organization_id, product_id, snapshot_on),
  foreign key (organization_id, product_id) references public.products(organization_id, id)
);

create table public.receivables (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  sale_id uuid,
  external_ref text not null,
  issued_on date not null,
  due_on date not null,
  amount numeric(14,2) not null check (amount > 0),
  paid_amount numeric(14,2) not null default 0 check (paid_amount >= 0 and paid_amount <= amount),
  source_import_id uuid,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (organization_id, external_ref),
  foreign key (organization_id, customer_id) references public.customers(organization_id, id),
  foreign key (organization_id, sale_id) references public.sales(organization_id, id)
);

create index sales_organization_id_sold_on_idx on public.sales(organization_id, sold_on);
create index sale_lines_organization_id_product_id_idx on public.sale_lines(organization_id, product_id);
create index sale_lines_organization_id_sale_id_idx on public.sale_lines(organization_id, sale_id);
create index receivables_organization_id_due_on_idx on public.receivables(organization_id, due_on);
create index inventory_snapshots_organization_id_snapshot_on_idx on public.inventory_snapshots(organization_id, snapshot_on);

create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();

create trigger customers_set_updated_at before update on public.customers
for each row execute function public.set_updated_at();

create trigger receivables_set_updated_at before update on public.receivables
for each row execute function public.set_updated_at();

alter table public.products enable row level security;
create policy products_select on public.products for select to authenticated
using (organization_id in (select public.my_org_ids()));
revoke all on public.products from public, anon, authenticated;
grant select on public.products to authenticated;

alter table public.customers enable row level security;
create policy customers_select on public.customers for select to authenticated
using (organization_id in (select public.my_org_ids()));
revoke all on public.customers from public, anon, authenticated;
grant select on public.customers to authenticated;

alter table public.sales enable row level security;
create policy sales_select on public.sales for select to authenticated
using (organization_id in (select public.my_org_ids()));
revoke all on public.sales from public, anon, authenticated;
grant select on public.sales to authenticated;

alter table public.sale_lines enable row level security;
create policy sale_lines_select on public.sale_lines for select to authenticated
using (organization_id in (select public.my_org_ids()));
revoke all on public.sale_lines from public, anon, authenticated;
grant select on public.sale_lines to authenticated;

alter table public.inventory_snapshots enable row level security;
create policy inventory_snapshots_select on public.inventory_snapshots for select to authenticated
using (organization_id in (select public.my_org_ids()));
revoke all on public.inventory_snapshots from public, anon, authenticated;
grant select on public.inventory_snapshots to authenticated;

alter table public.receivables enable row level security;
create policy receivables_select on public.receivables for select to authenticated
using (organization_id in (select public.my_org_ids()));
revoke all on public.receivables from public, anon, authenticated;
grant select on public.receivables to authenticated;
