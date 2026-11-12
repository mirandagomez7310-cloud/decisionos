create type public.org_role as enum ('owner', 'admin', 'analyst', 'viewer');

create table public.organizations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$'),
  country char(2) not null default 'MX',
  currency char(3) not null default 'MXN',
  timezone text not null default 'America/Mexico_City',
  settings jsonb not null default '{}',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role public.org_role not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (organization_id, user_id)
);
create index memberships_user_id_organization_id_idx on public.memberships(user_id, organization_id);

create table public.invitations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.org_role not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default pg_catalog.now() + interval '7 days',
  accepted_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default pg_catalog.now()
);
create unique index invitations_pending_email_idx on public.invitations(organization_id, pg_catalog.lower(email)) where accepted_at is null;
create index invitations_organization_id_expires_at_idx on public.invitations(organization_id, expires_at);

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  actor_kind text not null check (actor_kind in ('user', 'system', 'api')),
  action text not null,
  entity text not null,
  entity_id text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default pg_catalog.now()
);
create index audit_log_organization_id_created_at_idx on public.audit_log(organization_id, created_at desc);

create function public.my_org_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id from public.memberships m where m.user_id = (select auth.uid());
$$;

create function public.my_org_ids_with_role(roles public.org_role[]) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.organization_id from public.memberships m
  where m.user_id = (select auth.uid()) and m.role = any(roles);
$$;

create function public.create_organization(name text, slug text) returns public.organizations
language plpgsql security definer set search_path = '' as $$
declare
  organization public.organizations;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  insert into public.organizations(name, slug) values (name, slug) returning * into organization;
  insert into public.memberships(organization_id, user_id, role) values (organization.id, v_user_id, 'owner');
  insert into public.audit_log(organization_id, actor_user_id, actor_kind, action, entity, entity_id)
  values (organization.id, v_user_id, 'user', 'organization.created', 'organizations', organization.id::text);
  return organization;
end;
$$;

create function public.accept_invitation(token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  invitation public.invitations;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select i.* into invitation from public.invitations i
  where i.token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(token, 'UTF8')), 'hex')
  for update;
  if not found or invitation.expires_at <= pg_catalog.now() or invitation.accepted_at is not null
    or pg_catalog.lower(invitation.email) is distinct from pg_catalog.lower(auth.jwt() ->> 'email') then
    raise exception 'Invalid invitation' using errcode = '42501';
  end if;
  -- El orden del enum va de mayor a menor privilegio; aceptar nunca degrada.
  insert into public.memberships as m(organization_id, user_id, role)
  values (invitation.organization_id, v_user_id, invitation.role)
  on conflict (organization_id, user_id) do update set role = excluded.role
  where excluded.role < m.role;
  update public.invitations set accepted_at = pg_catalog.now() where id = invitation.id;
  insert into public.audit_log(organization_id, actor_user_id, actor_kind, action, entity, entity_id)
  values (invitation.organization_id, v_user_id, 'user', 'invitation.accepted', 'invitations', invitation.id::text);
  return invitation.organization_id;
end;
$$;

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();

create function public.protect_last_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' then
    if tg_op = 'UPDATE' then
      if new.role = 'owner' and new.organization_id = old.organization_id then
        return new;
      end if;
    end if;
    -- Serializa las bajas de owners; si el padre ya desapareció, es un borrado en cascada.
    perform 1 from public.organizations where id = old.organization_id for update;
    if found and not exists (
      select 1 from public.memberships
      where organization_id = old.organization_id and role = 'owner' and user_id <> old.user_id
    ) then
      raise exception 'Organization must retain an owner' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger memberships_protect_last_owner before delete or update on public.memberships
for each row execute function public.protect_last_owner();

create function public.audit_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  organization_id uuid;
  member_id uuid;
begin
  if tg_op = 'DELETE' then
    organization_id := old.organization_id;
    member_id := old.user_id;
  else
    organization_id := new.organization_id;
    member_id := new.user_id;
  end if;
  -- No se puede conservar un log de tenant cuando el propio tenant se borra.
  if exists (select 1 from public.organizations o where o.id = organization_id) then
    insert into public.audit_log(organization_id, actor_user_id, actor_kind, action, entity, entity_id, data)
    values (organization_id, auth.uid(), case when auth.uid() is null then 'system' else 'user' end,
      'membership.' || pg_catalog.lower(tg_op), 'memberships', member_id::text,
      pg_catalog.jsonb_build_object('old', case when tg_op <> 'INSERT' then pg_catalog.to_jsonb(old) end,
        'new', case when tg_op <> 'DELETE' then pg_catalog.to_jsonb(new) end));
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger memberships_audit after insert or update or delete on public.memberships
for each row execute function public.audit_membership();

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;

create policy organizations_select on public.organizations for select to authenticated
using (id in (select public.my_org_ids()));
create policy organizations_update on public.organizations for update to authenticated
using (id in (select public.my_org_ids_with_role('{owner,admin}')))
with check (id in (select public.my_org_ids_with_role('{owner,admin}')));
create policy organizations_delete on public.organizations for delete to authenticated
using (id in (select public.my_org_ids_with_role('{owner}')));

create policy memberships_select on public.memberships for select to authenticated
using (organization_id in (select public.my_org_ids()));
create policy memberships_insert on public.memberships for insert to authenticated
with check (organization_id in (select public.my_org_ids_with_role('{owner,admin}'))
  and (role <> 'owner' or organization_id in (select public.my_org_ids_with_role('{owner}'))));
create policy memberships_update on public.memberships for update to authenticated
using (organization_id in (select public.my_org_ids_with_role('{owner,admin}'))
  and (role <> 'owner' or organization_id in (select public.my_org_ids_with_role('{owner}'))))
with check (organization_id in (select public.my_org_ids_with_role('{owner,admin}'))
  and (role <> 'owner' or organization_id in (select public.my_org_ids_with_role('{owner}'))));
create policy memberships_delete on public.memberships for delete to authenticated
using (organization_id in (select public.my_org_ids_with_role('{owner,admin}'))
  and (role <> 'owner' or organization_id in (select public.my_org_ids_with_role('{owner}'))));

create policy invitations_select on public.invitations for select to authenticated
using (organization_id in (select public.my_org_ids_with_role('{owner,admin}')));
create policy invitations_insert on public.invitations for insert to authenticated
with check (organization_id in (select public.my_org_ids_with_role('{owner,admin}'))
  and (role <> 'owner' or organization_id in (select public.my_org_ids_with_role('{owner}'))));
create policy invitations_update on public.invitations for update to authenticated
using (organization_id in (select public.my_org_ids_with_role('{owner,admin}'))
  and (role <> 'owner' or organization_id in (select public.my_org_ids_with_role('{owner}'))))
with check (organization_id in (select public.my_org_ids_with_role('{owner,admin}'))
  and (role <> 'owner' or organization_id in (select public.my_org_ids_with_role('{owner}'))));
create policy invitations_delete on public.invitations for delete to authenticated
using (organization_id in (select public.my_org_ids_with_role('{owner,admin}'))
  and (role <> 'owner' or organization_id in (select public.my_org_ids_with_role('{owner}'))));

create policy audit_log_select on public.audit_log for select to authenticated
using (organization_id in (select public.my_org_ids_with_role('{owner,admin}')));
create policy audit_log_insert on public.audit_log for insert to authenticated
with check (organization_id in (select public.my_org_ids())
  -- El actor no se puede suplantar y los eventos de triggers y RPC no se pueden falsificar desde el cliente.
  and actor_user_id = (select auth.uid()) and actor_kind = 'user'
  and action not like 'membership.%' and action not like 'organization.%' and action not like 'invitation.%');

revoke all on public.organizations, public.memberships, public.invitations, public.audit_log from public, anon, authenticated;
revoke all on sequence public.audit_log_id_seq from public, anon, authenticated;
grant select, delete on public.organizations to authenticated;
grant select, insert, delete on public.memberships, public.invitations to authenticated;
grant select, insert on public.audit_log to authenticated;
grant usage on sequence public.audit_log_id_seq to authenticated;
revoke update, delete on public.audit_log from authenticated, anon;

-- Las identidades de membresía son inmutables para evitar traslados entre tenants.
grant update(role) on public.memberships to authenticated;
grant update(email, role, token_hash, expires_at) on public.invitations to authenticated;
grant update(name, slug, country, currency, timezone, settings) on public.organizations to authenticated;

revoke all on function public.my_org_ids(), public.my_org_ids_with_role(public.org_role[]),
  public.create_organization(text, text), public.accept_invitation(text), public.set_updated_at(),
  public.protect_last_owner(), public.audit_membership() from public, anon, authenticated;
grant execute on function public.my_org_ids(), public.my_org_ids_with_role(public.org_role[]),
  public.create_organization(text, text), public.accept_invitation(text) to authenticated;
