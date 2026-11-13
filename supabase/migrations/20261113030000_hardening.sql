drop policy memberships_insert on public.memberships;
revoke insert on public.memberships from authenticated;

drop policy audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert to authenticated
with check (organization_id in (select public.my_org_ids())
  and actor_user_id = (select auth.uid()) and actor_kind = 'user'
  and action ~ '^(imports|invitations|members)\.[a-z_]+$');
