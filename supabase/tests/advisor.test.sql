begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(25);

insert into public.organizations(id, name, slug) values
  ('52000000-0000-0000-0000-000000000001', 'A', 'advisor-a'),
  ('52000000-0000-0000-0000-000000000002', 'B', 'advisor-b');
insert into auth.users(id, email) values
  ('52000000-0000-0000-0000-000000000003', 'advisor-analyst@test.invalid'),
  ('52000000-0000-0000-0000-000000000004', 'advisor-viewer@test.invalid');
insert into public.memberships(organization_id, user_id, role) values
  ('52000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000003', 'analyst'),
  ('52000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000004', 'viewer');

insert into public.advisor_runs(organization_id, period_start, input_hash, status, created_at, error)
values
  ('52000000-0000-0000-0000-000000000002', date_trunc('month', now() at time zone 'America/Mexico_City')::date, repeat('b', 64), 'done', now(), null),
  ('52000000-0000-0000-0000-000000000001', date_trunc('month', now() at time zone 'America/Mexico_City')::date, repeat('f', 64), 'failed',
    ((now() at time zone 'America/Mexico_City')::date - 1)::timestamp at time zone 'America/Mexico_City', 'timeout'),
  ('52000000-0000-0000-0000-000000000001', date_trunc('month', now() at time zone 'America/Mexico_City')::date, repeat('f', 64), 'failed', now(), 'disabled'),
  ('52000000-0000-0000-0000-000000000001', date_trunc('month', now() at time zone 'America/Mexico_City')::date, repeat('f', 64), 'failed', now(), 'busy');

set local role authenticated;
set local request.jwt.claims = '{"sub":"52000000-0000-0000-0000-000000000004","role":"authenticated"}';
select throws_ok($$select public.request_advisor('52000000-0000-0000-0000-000000000001', repeat('a', 64), 2)$$::text, '42501', null::text, 'El viewer no puede solicitar Advisor');
select is((select used from public.advisor_usage('52000000-0000-0000-0000-000000000001')), 0,
  'El viewer puede consultar el uso, que excluye ayer y los fallos disabled y busy');

set local request.jwt.claims = '{"sub":"52000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok($$select public.request_advisor('52000000-0000-0000-0000-000000000002', repeat('a', 64), 2)$$::text, '42501', null::text, 'El analyst de A no puede solicitar Advisor en B');
select throws_ok($$select public.advisor_usage('52000000-0000-0000-0000-000000000002')$$::text, '42501', null::text, 'Solo un miembro puede consultar el uso');
select throws_ok($$select public.request_advisor('52000000-0000-0000-0000-000000000001', repeat('g', 64), 2)$$::text, '22023', null::text, 'El hash debe ser hexadecimal');
select throws_ok($$select public.request_advisor('52000000-0000-0000-0000-000000000001', repeat('a', 64), 0)$$::text, '22023', null::text, 'Se rechaza un límite fuera del intervalo');
select throws_ok($$select public.request_advisor('52000000-0000-0000-0000-000000000001', repeat('a', 64), null)$$::text, '22023', null::text, 'Se rechaza el límite nulo');
select throws_ok($$select public.request_advisor('52000000-0000-0000-0000-000000000001', null, 2)$$::text, '22023', null::text, 'Se rechaza el hash nulo');

do $$begin
  perform set_config('test.advisor_first', public.request_advisor('52000000-0000-0000-0000-000000000001', repeat('a', 64), 2)::text, true);
end$$;
select is(current_setting('test.advisor_first')::jsonb - 'run_id',
  '{"status":"queued","used":1,"limit":2}'::jsonb, 'La primera solicitud ocupa una consulta');
select is(public.request_advisor('52000000-0000-0000-0000-000000000001', repeat('b', 64), 2), jsonb_build_object('status', 'running', 'run_id', (current_setting('test.advisor_first')::jsonb->>'run_id')::uuid),
  'Una ejecución activa se devuelve incluso con otro hash');
select is((select count(*)::int from public.advisor_runs), 4,
  'El miembro de A no ve B y la segunda solicitud no crea otra ejecución');
select throws_ok($$insert into public.advisor_runs default values$$::text, '42501', null::text, 'authenticated no puede insertar ejecuciones');
select throws_ok($$update public.advisor_runs set status = 'done'$$::text, '42501', null::text, 'authenticated no puede actualizar ejecuciones');
select throws_ok($$delete from public.advisor_runs$$::text, '42501', null::text, 'authenticated no puede borrar ejecuciones');
select throws_ok($$select public.complete_advisor_run('52000000-0000-0000-0000-000000000001', 'done', null, 'fake', 'test', 11, 5, 2)$$::text, '42501', null::text, 'authenticated no puede cerrar ejecuciones');
reset role;

select is((select j.payload from public.jobs j where j.organization_id = '52000000-0000-0000-0000-000000000001' and j.kind = 'advisor'),
  jsonb_build_object('run_id', (current_setting('test.advisor_first')::jsonb->>'run_id')::uuid), 'El job contiene el ID de la ejecución solicitada');
select is((select actor_user_id from public.audit_log where action = 'advisor.requested'
  and organization_id = '52000000-0000-0000-0000-000000000001' and entity_id = (current_setting('test.advisor_first')::jsonb->>'run_id')::uuid::text),
  '52000000-0000-0000-0000-000000000003'::uuid, 'La solicitud queda auditada con el actor');

insert into public.insights(organization_id, module, kind, severity, title, body, evidence,
  metric_snapshot, period_start, period_end, generated_by, status)
select organization_id, 'sales', 'hypothesis', 'info', title, 'Cuerpo',
  jsonb_build_object('run_id', run_id), '{}', period_start, period_start, 'llm', status
from (values
  ('52000000-0000-0000-0000-000000000001'::uuid, date_trunc('month', now() at time zone 'America/Mexico_City')::date, 'anterior', '52000000-0000-0000-0000-000000000002'::uuid, 'new'),
  ('52000000-0000-0000-0000-000000000001', date_trunc('month', now() at time zone 'America/Mexico_City')::date, 'actual', (current_setting('test.advisor_first')::jsonb->>'run_id')::uuid, 'new'),
  ('52000000-0000-0000-0000-000000000001', date_trunc('month', now() at time zone 'America/Mexico_City')::date, 'visto', '52000000-0000-0000-0000-000000000002', 'seen'),
  ('52000000-0000-0000-0000-000000000001', date_trunc('month', now() at time zone 'America/Mexico_City')::date, 'hecho', '52000000-0000-0000-0000-000000000002', 'done'),
  ('52000000-0000-0000-0000-000000000002', date_trunc('month', now() at time zone 'America/Mexico_City')::date, 'otra organización', '52000000-0000-0000-0000-000000000002', 'new'),
  ('52000000-0000-0000-0000-000000000001', (date_trunc('month', now() at time zone 'America/Mexico_City')::date - interval '1 month')::date, 'otro periodo', '52000000-0000-0000-0000-000000000002', 'new')
) as fixtures(organization_id, period_start, title, run_id, status);

set local role service_role;
select lives_ok($$select public.complete_advisor_run((current_setting('test.advisor_first')::jsonb->>'run_id')::uuid, 'done', null, 'fake', 'test', 11, 5, 2)$$::text, 'service_role puede cerrar la ejecución');
update public.jobs set status = 'done' where organization_id = '52000000-0000-0000-0000-000000000001' and kind = 'advisor';
reset role;

select results_eq(
  $$select title, status from public.insights where title in ('actual', 'anterior', 'visto', 'hecho', 'otra organización', 'otro periodo')
    order by title collate "C"$$::text,
  $$values ('actual'::text, 'new'::text), ('anterior', 'dismissed'), ('hecho', 'done'),
    ('otra organización', 'new'), ('otro periodo', 'new'), ('visto', 'seen')$$::text,
  'Solo se descarta el insight nuevo de otra ejecución del mismo periodo y organización');

set local role authenticated;
do $$begin
  perform set_config('test.advisor_cache', public.request_advisor('52000000-0000-0000-0000-000000000001', repeat('a', 64), 1)::text, true);
end$$;
select is(current_setting('test.advisor_cache')::jsonb->>'status', 'cached',
  'La caché se consulta antes del límite');
select ok((select cached and status = 'done' and driver = 'fake' and model = 'test' and items = 2
  and input_tokens is null and output_tokens is null and finished_at is not null
  from public.advisor_runs where id = (current_setting('test.advisor_cache')::jsonb->>'run_id')::uuid),
  'El acierto copia los metadatos de caché y queda cerrado');
select is((select used from public.advisor_usage('52000000-0000-0000-0000-000000000001')), 1, 'La caché no consume otra consulta');
do $$begin
  perform set_config('test.advisor_second', public.request_advisor('52000000-0000-0000-0000-000000000001', repeat('b', 64), 2)::text, true);
end$$;
select is(current_setting('test.advisor_second')::jsonb - 'run_id',
  '{"status":"queued","used":2,"limit":2}'::jsonb, 'La segunda ejecución sin caché se encola');
reset role;

set local role service_role;
select public.complete_advisor_run((current_setting('test.advisor_second')::jsonb->>'run_id')::uuid, 'failed', 'timeout', 'fake', 'test', 11, 5, 2);
update public.jobs set status = 'failed'
where organization_id = '52000000-0000-0000-0000-000000000001' and kind = 'advisor' and status = 'queued';
reset role;

set local role authenticated;
select is(public.request_advisor('52000000-0000-0000-0000-000000000001', repeat('c', 64), 2), '{"status":"limit","used":2,"limit":2}'::jsonb,
  'La tercera consulta se bloquea porque el fallo del modelo sí cuenta');
reset role;

set local role anon;
select throws_ok($$select * from public.advisor_runs$$::text, '42501', null::text, 'anon no puede leer ejecuciones');
reset role;

select * from finish();
rollback;
