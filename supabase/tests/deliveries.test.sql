begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

insert into public.organizations(id, name, slug) values
  ('52000000-0000-0000-0000-000000000001', 'A', 'deliveries-a'),
  ('52000000-0000-0000-0000-000000000002', 'B', 'deliveries-b');
insert into auth.users(id, email) values
  ('52000000-0000-0000-0000-000000000003', 'alerts-owner@test.invalid'),
  ('52000000-0000-0000-0000-000000000004', 'alerts-admin@test.invalid'),
  ('52000000-0000-0000-0000-000000000005', 'alerts-analyst@test.invalid'),
  ('52000000-0000-0000-0000-000000000006', 'alerts-viewer@test.invalid'),
  ('52000000-0000-0000-0000-000000000007', 'alerts-other@test.invalid');
insert into public.memberships(organization_id, user_id, role) values
  ('52000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000003', 'owner'),
  ('52000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000004', 'admin'),
  ('52000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000005', 'analyst'),
  ('52000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000006', 'viewer'),
  ('52000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000007', 'owner');

insert into public.insights(id, organization_id, module, kind, severity, title, body,
  evidence, metric_snapshot, period_start, period_end, generated_by, status, created_at)
select v.id::uuid, v.org::uuid, 'cash', 'suggestion', v.severity, 'Insight', 'Detalle',
  '{}', '{}', date '2026-11-01', date '2026-11-17', 'llm', v.status, now() - v.age::interval
from (values
  ('52000000-0000-0000-0000-000000000011', '52000000-0000-0000-0000-000000000001', 'warning', 'new', '0 days'),
  ('52000000-0000-0000-0000-000000000012', '52000000-0000-0000-0000-000000000001', 'critical', 'new', '0 days'),
  ('52000000-0000-0000-0000-000000000013', '52000000-0000-0000-0000-000000000001', 'info', 'new', '0 days'),
  ('52000000-0000-0000-0000-000000000014', '52000000-0000-0000-0000-000000000001', 'warning', 'seen', '0 days'),
  ('52000000-0000-0000-0000-000000000015', '52000000-0000-0000-0000-000000000001', 'warning', 'new', '8 days'),
  ('52000000-0000-0000-0000-000000000016', '52000000-0000-0000-0000-000000000002', 'critical', 'new', '0 days')
) v(id, org, severity, status, age);

set local role service_role;
insert into public.deliveries(organization_id, kind, dedupe_key, insight_id,
  recipient_user_id, recipient_email, status, attempts)
select '52000000-0000-0000-0000-000000000001', 'alert', 'alert:' || v.insight || ':' || v.recipient,
  v.insight::uuid, v.recipient::uuid, v.email, v.status, v.attempts
from (values
  ('52000000-0000-0000-0000-000000000011', '52000000-0000-0000-0000-000000000003', 'alerts-owner@test.invalid', 'sent', 0),
  ('52000000-0000-0000-0000-000000000011', '52000000-0000-0000-0000-000000000004', 'alerts-admin@test.invalid', 'failed', 3),
  ('52000000-0000-0000-0000-000000000012', '52000000-0000-0000-0000-000000000003', 'alerts-owner@test.invalid', 'failed', 1)
) v(insight, recipient, email, status, attempts);

select set_eq($$select * from public.alert_recipients('52000000-0000-0000-0000-000000000001')$$,
  $$values ('52000000-0000-0000-0000-000000000003'::uuid, 'alerts-owner@test.invalid'::text),
    ('52000000-0000-0000-0000-000000000004'::uuid, 'alerts-admin@test.invalid'::text)$$,
  'Solo owner y admin de A');
select set_eq($$select * from public.pending_alerts('52000000-0000-0000-0000-000000000001')$$,
  $$values ('52000000-0000-0000-0000-000000000012'::uuid, '52000000-0000-0000-0000-000000000003'::uuid, 'alerts-owner@test.invalid'::text),
    ('52000000-0000-0000-0000-000000000012'::uuid, '52000000-0000-0000-0000-000000000004'::uuid, 'alerts-admin@test.invalid'::text)$$,
  'Solo alertas nuevas y recientes, con reintento tras un fallo y tope de tres');
select set_eq($$select * from public.pending_alerts('52000000-0000-0000-0000-000000000002')$$,
  $$values ('52000000-0000-0000-0000-000000000016'::uuid, '52000000-0000-0000-0000-000000000007'::uuid, 'alerts-other@test.invalid'::text)$$,
  'B solo recibe sus propios insights y destinatarios');
select throws_ok($$insert into public.deliveries(organization_id, kind, dedupe_key,
    insight_id, recipient_user_id, recipient_email)
  values ('52000000-0000-0000-0000-000000000001', 'alert', 'cross-tenant', '52000000-0000-0000-0000-000000000016', '52000000-0000-0000-0000-000000000003', 'alerts-owner@test.invalid')$$,
  '23503', null, 'La FK rechaza insights de otra organización');
select throws_ok($$insert into public.deliveries(organization_id, kind, dedupe_key,
    insight_id, recipient_user_id, recipient_email)
  values ('52000000-0000-0000-0000-000000000001', 'alert', 'alert:52000000-0000-0000-0000-000000000011:52000000-0000-0000-0000-000000000003', '52000000-0000-0000-0000-000000000011', '52000000-0000-0000-0000-000000000003', 'alerts-owner@test.invalid')$$,
  '23505', null, 'La clave de deduplicación es única en A');
select ok(public.enqueue_alerts('52000000-0000-0000-0000-000000000001'), 'Encola el primer job de alertas');
select ok(not public.enqueue_alerts('52000000-0000-0000-0000-000000000001'), 'Deduplica el job activo');

set local role authenticated;
select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000003', true);
select throws_ok('select * from public.deliveries', '42501', null, 'Owner no lee entregas');
select throws_ok($$select * from public.alert_recipients('52000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'Owner no resuelve destinatarios de B');
select throws_ok($$select * from public.pending_alerts('52000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'Owner no consulta alertas de B');
select throws_ok($$select public.enqueue_alerts('52000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'Owner no encola alertas de B');

set local role anon;
select throws_ok('select * from public.deliveries', '42501', null, 'Anon no lee entregas');
select throws_ok($$select * from public.alert_recipients('52000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'Anon no resuelve destinatarios');
select throws_ok($$select * from public.pending_alerts('52000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'Anon no consulta alertas');
select throws_ok($$select public.enqueue_alerts('52000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'Anon no encola alertas');

reset role;
select * from finish();
rollback;
