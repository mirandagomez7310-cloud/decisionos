# DecisionOS — Modelo de datos inicial

Estado: `0003_imports_jobs` escrita (pendiente de verificación). `0002_business` escrita (pendiente de verificación). `0001_core` validada en CI (pgTAP: 4 suites, 155 aserciones, 2026-11-12). Las tablas se crean fase a fase (`ROADMAP.md`); este documento se actualiza con cada migración. Postgres 17 en Supabase, esquema `public`.

## Convenciones

- Nombres en inglés, `snake_case`, tablas en plural. Columnas de tiempo `created_at`, `updated_at` (`timestamptz`, trigger `set_updated_at`).
- Claves: `id uuid default gen_random_uuid()`, salvo tablas de alto volumen e insert-only (`audit_log`, `import_rows`) con `bigint generated always as identity`.
- **Toda tabla de tenant lleva `organization_id uuid not null references organizations(id)`** y RLS activado en la misma migración.
- **Referencias entre tablas de tenant son compuestas**: `foreign key (organization_id, product_id) references products (organization_id, id)`. Cada tabla referenciada tiene `unique (organization_id, id)`. Así una fila nunca apunta a otra organización.
- Dinero: `numeric(14,2)` para importes, `numeric(14,4)` para precios y costos unitarios, `numeric(14,3)` para cantidades. Nunca `float`. Moneda en `organizations.currency` (`char(3)`, por defecto `MXN`) y copiada en `sales.currency` para no cerrar la puerta a multi-moneda.
- Fechas de negocio en `date` (`sold_on`, `due_on`, `snapshot_on`); los orígenes CSV rara vez traen hora.
- Enums de Postgres para estados cerrados; `text` + `check` cuando el conjunto pueda crecer por organización.
- Borrado: lógico (`active`, `status`) en datos de negocio; físico solo en `import_rows` al revertir una importación.

## Roles y permisos (`org_role`)

| Acción | viewer | analyst | admin | owner |
|---|---|---|---|---|
| Ver dashboards, módulos, insights, reports | ✔ | ✔ | ✔ | ✔ |
| Marcar insights (visto, descartado, hecho) | | ✔ | ✔ | ✔ |
| Importar y revertir importaciones | | | ✔ | ✔ |
| Editar productos y clientes (catálogo) | | ✔ | ✔ | ✔ |
| Gestionar miembros e invitaciones, ajustes, ver `audit_log` | | | ✔ | ✔ |
| Facturación, borrar organización, transferir propiedad | | | | ✔ |

## Funciones de autorización (base de todas las políticas)

```sql
create type public.org_role as enum ('owner', 'admin', 'analyst', 'viewer');

-- Organizaciones del usuario actual (sin argumentos: Postgres la evalúa una vez por consulta como initplan)
create function public.my_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id from public.memberships m where m.user_id = (select auth.uid());
$$;

-- Organizaciones donde el usuario actual tiene alguno de los roles
create function public.my_org_ids_with_role(roles public.org_role[]) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id from public.memberships m
  where m.user_id = (select auth.uid()) and m.role = any(roles);
$$;
```

Leen `memberships`, no el JWT: revocar acceso surte efecto en la siguiente consulta. No reciben la columna de la fila como argumento: una función con `organization_id` como parámetro se ejecutaría **por fila**, y las agregaciones sobre `sale_lines` son el camino caliente del producto. Con `organization_id in (select …)` el conjunto se calcula una vez por consulta. Se comprueba con `EXPLAIN (ANALYZE)` sobre las vistas de métricas en la fase 2 con datos reales; índice `(user_id, organization_id)` en `memberships`.

Patrón de políticas de negocio (ejemplo `products`):

```sql
alter table public.products enable row level security;
create policy products_select on public.products for select to authenticated
  using (organization_id in (select public.my_org_ids()));
revoke all on public.products from public, anon, authenticated;
grant select on public.products to authenticated;
```

`anon` no tiene políticas en ninguna tabla. La clave de servicio (jobs, importaciones) salta RLS: cada función de ese camino recibe `organization_id` explícito, lo escribe en cada fila y registra en `audit_log`.

**Vistas.** Una vista normal se ejecuta con los permisos de su propietario y **salta las políticas de las tablas**. Toda vista de métricas se crea `with (security_invoker = true)` para que apliquen las políticas del usuario que consulta. Las vistas materializadas no admiten RLS ni `security_invoker`: si hace falta materializar, la vista vive en un esquema no expuesto por la API (`private`) y se lee a través de una función `security invoker` que filtra por `organization_id in (select public.my_org_ids())`.

**Storage.** Un solo bucket privado `imports`; ruta `<organization_id>/<uuid>-<archivo>`, con nombre limitado a `[A-Za-z0-9._-]+` y sin subdirectorios. El `check` de `imports.storage_path` impide rutas con traversal. Lectura e inserción solo para owner/admin: `bucket_id = 'imports'` y `(storage.foldername(name))[1] in (select id::text from public.my_org_ids_with_role('{owner,admin}') as id)`. Sin update/delete para authenticated; borrado por servicio. Límite 25 MiB y MIME CSV, XLSX, XLS y texto plano. Subida y descarga para validar el mapeo mediante el cliente de usuario, aplicando las políticas de storage; el worker descarga con servicio.

## Tablas

### Núcleo de tenant (fase 1)

**organizations**
`id` · `name text` · `slug text unique` (URL) · `country char(2) default 'MX'` · `currency char(3) default 'MXN'` · `timezone text default 'America/Mexico_City'` · `settings jsonb default '{}'` · `created_at` · `updated_at`.
Lectura: miembros. Actualización: owner/admin; borrado: solo owner; sin inserción directa. Creación: función `create_organization(name text, slug text)` que devuelve la fila `organizations` (incluido su `id`), exige usuario autenticado e inserta organización, membresía `owner` y auditoría en la misma transacción (`security definer`, `set search_path = ''`). `slug` cumple `^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$`.

**memberships**
`organization_id` · `user_id uuid references auth.users` · `role org_role` · `created_at`. PK `(organization_id, user_id)`; índice `(user_id, organization_id)`.
Inserción solo por las RPC `create_organization` y `accept_invitation`; `authenticated` no tiene permiso de inserción directa. Lectura: miembros de la misma organización. Actualización y borrado: owner/admin, **pero una fila con `role = 'owner'` (cambiarla o borrarla) solo la toca un owner**, en la política y no solo en la UI; un owner no puede borrarse ni degradarse si es el último owner (trigger que bloquea la organización para serializar bajas). Trigger que escribe en `audit_log` todo cambio, con `data.old` y `data.new`; actor nulo y `actor_kind = 'system'` en el camino de servicio sin usuario.

**invitations**
`id` · `organization_id` · `email text` · `role org_role` · `token_hash text` · `expires_at default now() + interval '7 days'` · `accepted_at null` · `created_by uuid references auth.users` · `created_at`. Lectura y escritura: owner/admin, con `created_by = auth.uid()` en la política; desde el cliente solo se actualiza `role` (token y caducidad no: se borra y se crea otra); `check (expires_at <= created_at + 30 días)` con `insert` concedido solo sobre las columnas que el cliente debe fijar (ni `id`, ni `created_at`, ni `accepted_at`). Las invitaciones de rol owner solo las crea, modifica o borra un owner para evitar escaladas indirectas. `token_hash` es único, hexadecimal SHA-256 de 64 caracteres; no se guarda el token en claro. La app genera 32 bytes aleatorios y calcula el hash de la representación textual UTF-8 enviada por URL. Índice único parcial `(organization_id, lower(email)) where accepted_at is null`: impide duplicados incluso con distintas mayúsculas. Índice adicional `(organization_id, expires_at)`.

`accept_invitation(token text)` devuelve `organization_id` (`security definer`, `set search_path = ''`): exige usuario autenticado, bloquea la invitación por hash y valida caducidad, aceptación previa, correo de `auth.jwt()` sin distinguir mayúsculas y que quien invitó siga siendo owner/admin con rango para ese rol (una invitación muere con la membresía de quien la creó). Inserta membresía o eleva el rol existente (el enum está ordenado de mayor a menor privilegio), marca aceptación y audita en la misma transacción. Una invitación nunca degrada.

**audit_log** (insert-only)
`id bigint identity` · `organization_id` · `actor_user_id uuid null references auth.users` · `actor_kind text check in ('user','system','api')` · `action text` · `entity text` · `entity_id text` · `data jsonb default '{}'` · `created_at`. Lectura: owner/admin. Inserción: cualquier miembro de la organización, solo con `actor_user_id = auth.uid()`, `actor_kind = 'user'` y acciones que cumplan `action ~ '^(imports|invitations|members)\.[a-z_]+$'` (los eventos de triggers y RPC quedan reservados). Sin políticas ni permisos de update/delete para authenticated/anon. Índice `(organization_id, created_at desc)`.

**Integridad y permisos del núcleo.** Las referencias a organizaciones llevan `on delete cascade` para que el owner pueda borrar el tenant completo; sus logs también desaparecen y las bajas por esa cascada no generan auditoría nueva. Los demás campos son obligatorios salvo los declarados nulos. No hay FKs compuestas en este corte: las únicas referencias son al tenant raíz y a `auth.users`; las referencias compuestas entre datos de negocio llegan en fase 2. `authenticated` solo actualiza campos editables: ajustes de organización; `memberships.role`; correo, rol, hash y caducidad de invitaciones. Identidades, fechas y aceptación no son editables directamente. `anon` no tiene permisos sobre las tablas, la secuencia ni las funciones del núcleo. Solo las cuatro RPC tienen ejecución concedida a `authenticated`; las funciones de trigger no se exponen. UUID y SHA-256 usan funciones nativas de Postgres, sin extensiones adicionales.

### Datos de negocio (fase 2)

Escritura exclusivamente por servicio (importaciones con `organization_id` explícito y auditoría); todos los roles de miembros solo leen mediante RLS. La edición de catálogo de la matriz usa ese camino de servicio. Todos los campos son obligatorios salvo los declarados nulos. Las FKs al tenant llevan `on delete cascade`; las referencias entre datos de negocio son compuestas, sin cascada. `source_import_id` tiene FK compuesta a `imports(organization_id, id)` desde `0003_imports_jobs`. Solo `products`, `customers` y `receivables` tienen trigger `set_updated_at`.

**products**
`id` · `organization_id` · `sku text` · `name text` · `category text null` · `unit text null` · `standard_cost numeric(14,4) null` · `list_price numeric(14,4) null` · `active bool default true` · `created_at` · `updated_at`.
`unique (organization_id, sku)` · `unique (organization_id, id)`.

**customers**
`id` · `organization_id` · `code text` · `name text` · `segment text null` · `credit_limit numeric(14,2) null` · `payment_terms_days int null` · `active bool default true` · `created_at` · `updated_at`.
`unique (organization_id, code)` · `unique (organization_id, id)`.

**sales** (cabecera: factura, remisión o pedido entregado)
`id` · `organization_id` · `external_ref text` (folio del sistema origen) · `customer_id` · `sold_on date` · `status text check in ('completed','cancelled','returned')` · `currency char(3) default 'MXN'` · `subtotal numeric(14,2)` · `tax numeric(14,2)` · `total numeric(14,2)` · `source_import_id uuid null` · `created_at`.
`unique (organization_id, external_ref)` (reimportar el mismo folio actualiza, no duplica) · `unique (organization_id, id)` · FK compuesta a `customers`. Índice `(organization_id, sold_on)`.

**sale_lines**
`id` · `organization_id` · `sale_id` · `product_id` · `quantity numeric(14,3)` · `unit_price numeric(14,4)` · `unit_cost numeric(14,4) null` (costo en el momento de la venta; `null` si el origen no lo trae: las métricas de margen declaran cobertura) · `discount numeric(14,2) default 0` · `line_total numeric(14,2)`.
FKs compuestas a `sales` y `products`. Índices `(organization_id, product_id)` y `(organization_id, sale_id)`. `quantity <> 0`, `unit_price >= 0`; `line_total` es una columna normal recibida del origen.

**inventory_snapshots** (existencias por fecha; los movimientos llegan cuando un origen los exporte)
`organization_id` · `product_id` · `snapshot_on date` · `quantity numeric(14,3)` · `unit_cost numeric(14,4) null` · `source_import_id uuid null`. PK `(organization_id, product_id, snapshot_on)`. FK compuesta a `products`; índice `(organization_id, snapshot_on)`.

**receivables** (cuentas por cobrar)
`id` · `organization_id` · `customer_id` · `sale_id uuid null` · `external_ref text` · `issued_on date` · `due_on date` · `amount numeric(14,2)` · `paid_amount numeric(14,2) default 0` · `source_import_id uuid null` · `created_at` · `updated_at`.
`unique (organization_id, external_ref)`. FKs compuestas a `customers` y `sales`; índice `(organization_id, due_on)`. `amount > 0` y `paid_amount >= 0 and paid_amount <= amount`. El estado (abierta, vencida, pagada) se deriva en vista, no se almacena.

### Importación y trabajos (fase 2)

**imports**
Lectura: cualquier miembro. Inserción: owner/admin, `created_by = auth.uid()` y estado inicial `pending`; grant solo sobre `organization_id, kind, storage_path, original_filename, column_mapping, created_by`. Sin update/delete para authenticated. `unique (organization_id, id)`; ruta obligatoriamente bajo `organization_id/`. `column_mapping` por defecto `{}`; contadores no negativos por defecto 0. `created_by` referencia `auth.users`.
`id` · `organization_id` · `kind text check in ('sales','products','customers','inventory','receivables')` · `storage_path text` (bucket privado; `^<org>/[0-9a-f-]{36}-[A-Za-z0-9._-]+$`) · `original_filename text` · `status text check in ('pending','processing','done','failed','reverted')` · `column_mapping jsonb` · `preview jsonb not null default '[]'` (primeras 20 filas válidas, `{rowNumber, data}`, guardadas al validar; el detalle no descarga el archivo) · `row_count int` · `ok_count int` · `error_count int` · `created_by uuid` · `created_at` · `finished_at null`.

**import_rows** (staging)
Lectura: owner/admin; escritura solo servicio. FK compuesta a imports; índice `(import_id, row_number)` y número de fila positivo.
`id bigint identity` · `import_id` · `organization_id` · `row_number int` · `raw jsonb` · `error text null`. Se consulta para mostrar errores por fila; se borra al revertir.

**jobs**
`id` · `organization_id uuid null` (null = sistema) · `kind text` · `payload jsonb` · `status text check in ('queued','running','done','failed')` · `attempts int default 0` · `max_attempts int default 3` · `run_after timestamptz default now()` · `locked_at null` · `locked_by text null` · `progress jsonb` · `last_error text null` · `created_at` · `finished_at null`.
`kind` limitado a `import` y `revert_import`; `payload` y `progress` por defecto `{}`, estado inicial `queued`, intentos no negativos y máximo positivo. Sin trigger `updated_at`.

`claim_job(worker text, kinds text[])`: solo service_role, security definer con search_path vacío. Reclama un queued vencido del tipo solicitado con intentos restantes mediante `FOR UPDATE SKIP LOCKED`, lo marca running, incrementa attempts y fija bloqueo; devuelve null si no hay. `complete_job(id uuid, status text, last_error text)`: mismos permisos, acepta done/failed sobre un running, limpia bloqueo y fija finished_at al terminar. Failed con intentos restantes vuelve a queued, sin finished_at, con espera de un minuto por intento.

Índice parcial `(run_after) where status = 'queued'`. Solo la clave de servicio escribe; los miembros leen los de su organización (progreso de importación).

**RPC de importación (`20261113020000_imports_rpc.sql`).** Todas son `security definer`, fijan `search_path = ''` y solo permiten ejecución a `service_role`. Reciben `p_organization_id uuid` y `p_import_id uuid`; bloquean la importación y exigen que pertenezca a esa organización (`42501` en caso contrario).

- `apply_import_sales(..., p_rows jsonb)` devuelve `(inserted_sales int, inserted_lines int, rejected jsonb)`: crea catálogos nuevos que traen nombre, agrupa cabeceras, calcula subtotal y total en SQL con `numeric`, hace upsert de ventas y reemplaza sus líneas dentro de una transacción. Rechaza cabeceras inconsistentes con `22023`.
- `apply_import_products`, `apply_import_customers`, `apply_import_inventory` y `apply_import_receivables` reciben el mismo `p_rows` y devuelven `(inserted_<kind> int, rejected jsonb)`. Hacen upsert en conjunto; los catálogos conservan opcionales/active ausentes y las cuentas resuelven `sale_id` por `sale_external_ref` de la organización.
- `rejected` contiene `{external_ref, row_number, motivo}` para referencias de catálogo inexistentes sin nombre. El worker registra esas filas en `import_rows`, envía hasta 2.000 filas por RPC y actualiza el progreso por lote. Los folios viajan completos; un folio con más de 2.000 líneas se detecta antes de aplicar ventas.
- `revert_import(...) returns void` elimina líneas, ventas, inventarios, cuentas y errores del import, y lo marca `reverted`. Conserva productos/clientes y desvincula las cuentas de otros imports antes de borrar sus ventas asociadas.

### Inteligencia (fase 5)

**insights**
`id` · `organization_id` · `module text check in ('executive','sales','profit','inventory','cash')` · `kind insight_kind` (`fact`, `hypothesis`, `suggestion`) · `severity text check in ('info','warning','critical')` · `title text` · `body text` · `evidence jsonb` (métrica, periodo, ids de filas o consulta) · `metric_snapshot jsonb` (cifras en el momento de generarse) · `period_start date` · `period_end date` · `generated_by text check in ('rule','llm')` · `rule_key text null` · `status text check in ('new','seen','dismissed','done')` · `created_at`.
Un `fact` solo lo genera una regla (`generated_by = 'rule'`); el LLM solo puede crear `hypothesis` y `suggestion`, y siempre con `evidence` que apunte a insights o métricas existentes. Esta restricción va en un `check` y en el adaptador.

Las alertas son insights con `severity in ('warning','critical')`; el envío se registra en `alert_deliveries` (fase 5).

### Previstas, no diseñadas

`alert_rules`, `alert_deliveries`, `reports` (programados), `api_tokens` (fase 7), `subscriptions` y `plans` (fase 7). Todas con `organization_id` y el mismo patrón RLS.

## Métricas en SQL

Implementadas en `20261114000000_metrics.sql` (0004). Vista `sale_lines_enriched with (security_invoker = true)`: líneas con `sold_on`, `status` y `customer_id`, unidas a ventas por la FK compuesta. SELECT solo para authenticated.

RPC SQL stable, security invoker, search_path vacío y EXECUTE solo para authenticated (revocado a public y anon). Todas filtran la organización solicitada y ventas completed; RLS limita los datos al usuario.

- `metrics_summary(p_organization_id uuid, p_from date, p_to date, p_prev_from date, p_prev_to date)`: una fila con net_sales, prev_net_sales, net_sales_change_pct, sales_count (cabeceras), gross_margin, margin_base, margin_pct, prev_margin_pct, margin_pct_change_pts y coverage.
- `metrics_daily_sales(p_organization_id uuid, p_from date, p_to date)`: day y net_sales, un día por fila del rango inclusivo mediante generate_series, con cero sin ventas.
- `metrics_by_product` y `metrics_by_customer`: mismos cinco parámetros del resumen; devuelven tablas compatibles con order/range de PostgREST. Incluyen entidades con ventas en cualquiera de los periodos: product_id/sku/name o customer_id/code/name, net_sales, prev_net_sales, delta, delta_pct, gross_margin, margin_pct y coverage.

Todos los importes y cocientes se calculan con numeric en SQL, nunca en TypeScript:

- Venta neta: sum(sale_lines.line_total) de ventas completed con sold_on en el rango inclusivo; cancelled y returned no cuentan.
- Base de margen: venta neta de las líneas con unit_cost no nulo.
- Margen bruto: sum(line_total - quantity * unit_cost) de esas líneas, redondeado a 2 decimales.
- Margen %: margen bruto / base de margen * 100, a 1 decimal; null si la base es cero.
- Cobertura: base de margen / venta neta * 100, a 1 decimal; null si la venta neta es cero.
- Variación %: (actual - anterior) / anterior * 100, a 1 decimal; null si anterior es cero (sin comparación).
- Variación de margen en puntos: margen_pct_actual - margen_pct_anterior, a 1 decimal; null si falta alguno.

Los agregados sin datos devuelven importes y conteos cero, con porcentajes null. Los periodos de aplicación se resuelven en TS puro, con fecha local America/Mexico_City.

## Tests pgTAP (uno por tabla, `supabase/tests/<tabla>_rls.test.sql`)

1. `anon` no lee ni escribe.
2. Cada rol hace lo que la matriz permite y nada más (escritura denegada seguida de lectura que prueba la fila intacta).
3. **Denegación cruzada**: un `owner` de la organización A no ve, actualiza ni borra filas de B, y un `insert` con `organization_id` de B falla.
4. Las FKs compuestas rechazan una referencia a otra organización.
5. Cada vista de métricas: un miembro de A no obtiene filas de B (prueba que `security_invoker` está puesto).
6. `storage.objects`: un miembro de A no lista, lee ni sube en el prefijo de B.

## Orden de migraciones

1. `0001_core`: `org_role`, `organizations`, `memberships`, `invitations`, `audit_log`, funciones `my_org_ids`, `my_org_ids_with_role`, `create_organization`, `accept_invitation`, triggers de `updated_at`, último owner y auditoría, políticas, permisos mínimos y tests.
2. `0002_business`: `products`, `customers`, `sales`, `sale_lines`, `inventory_snapshots`, `receivables`.
3. `0003_imports_jobs`: `imports`, `import_rows`, `jobs`, bucket privado `imports` con sus políticas en `storage.objects` y test cruzado.
4. `0004_metrics_views`: escrita en `20261114000000_metrics.sql`; vista y RPC de métricas.
5. `0005_insights`: `insight_kind`, `insights`. (`alert_deliveries` y `alert_rules` se diseñan en la fase 5, en una migración propia.)

## Reversión de importaciones

La reversión elimina ventas y líneas, inventarios y cuentas por cobrar de source_import_id, además del staging. Productos y clientes se conservan: no tienen source_import_id. Las cuentas de otras importaciones conservan sus saldos y pierden solo la referencia a la venta eliminada.
