-- Los puntos 4 (FKs compuestas), 5 (vistas) y 6 (storage) no aplican al núcleo.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(25);
insert into auth.users(id, email) values
('00000000-0000-0000-0000-000000000001','user1@test.invalid'),
('00000000-0000-0000-0000-000000000002','user2@test.invalid'),
('00000000-0000-0000-0000-000000000003','user3@test.invalid'),
('00000000-0000-0000-0000-000000000004','user4@test.invalid'),
('00000000-0000-0000-0000-000000000005','user5@test.invalid'),
('00000000-0000-0000-0000-000000000006','user6@test.invalid');
insert into public.organizations(id,name,slug) values ('10000000-0000-0000-0000-000000000001','Tenant A','tenant-a'),('10000000-0000-0000-0000-000000000002','Tenant B','tenant-b');
insert into public.memberships(organization_id,user_id,role) values
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','owner'),
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','admin'),
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','analyst'),
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','viewer'),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000005','owner');
insert into public.invitations(id,organization_id,email,role,token_hash,created_by) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','user6@test.invalid','analyst',encode(sha256(convert_to('token-a','UTF8')),'hex'),'00000000-0000-0000-0000-000000000001'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','user6@test.invalid','viewer',encode(sha256(convert_to('token-b','UTF8')),'hex'),'00000000-0000-0000-0000-000000000005');

set local role anon;
select throws_ok($$select * from public.audit_log$$, '42501', null::text, 'anon: select denegado');
select throws_ok($$insert into public.audit_log(organization_id,actor_kind,action,entity,entity_id) values ('10000000-0000-0000-0000-000000000001','user','test.insert','test','1')$$, '42501', null::text, 'anon: insert denegado');
select throws_ok($$update public.audit_log set action = 'hacked'$$, '42501', null::text, 'anon: update denegado');
select throws_ok($$delete from public.audit_log$$, '42501', null::text, 'anon: delete denegado');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"user1@test.invalid","role":"authenticated"}';
select results_eq($$select count(*) > 0 from public.audit_log where organization_id='10000000-0000-0000-0000-000000000001'$$, array[true], 'rol 1: lectura audit');
select lives_ok($$insert into public.audit_log(organization_id,actor_kind,action,entity,entity_id) values ('10000000-0000-0000-0000-000000000001','user','role.1','test','1')$$, 'rol 1: miembro inserta audit');
select throws_ok($$update public.audit_log set action='hacked'$$, '42501', null::text, 'audit no se actualiza');
select throws_ok($$delete from public.audit_log$$, '42501', null::text, 'audit no se borra');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"user2@test.invalid","role":"authenticated"}';
select results_eq($$select count(*) > 0 from public.audit_log where organization_id='10000000-0000-0000-0000-000000000001'$$, array[true], 'rol 2: lectura audit');
select lives_ok($$insert into public.audit_log(organization_id,actor_kind,action,entity,entity_id) values ('10000000-0000-0000-0000-000000000001','user','role.2','test','1')$$, 'rol 2: miembro inserta audit');
select throws_ok($$update public.audit_log set action='hacked'$$, '42501', null::text, 'audit no se actualiza');
select throws_ok($$delete from public.audit_log$$, '42501', null::text, 'audit no se borra');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"user3@test.invalid","role":"authenticated"}';
select results_eq($$select count(*) > 0 from public.audit_log where organization_id='10000000-0000-0000-0000-000000000001'$$, array[false], 'rol 3: lectura audit');
select lives_ok($$insert into public.audit_log(organization_id,actor_kind,action,entity,entity_id) values ('10000000-0000-0000-0000-000000000001','user','role.3','test','1')$$, 'rol 3: miembro inserta audit');
select throws_ok($$update public.audit_log set action='hacked'$$, '42501', null::text, 'audit no se actualiza');
select throws_ok($$delete from public.audit_log$$, '42501', null::text, 'audit no se borra');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","email":"user4@test.invalid","role":"authenticated"}';
select results_eq($$select count(*) > 0 from public.audit_log where organization_id='10000000-0000-0000-0000-000000000001'$$, array[false], 'rol 4: lectura audit');
select lives_ok($$insert into public.audit_log(organization_id,actor_kind,action,entity,entity_id) values ('10000000-0000-0000-0000-000000000001','user','role.4','test','1')$$, 'rol 4: miembro inserta audit');
select throws_ok($$update public.audit_log set action='hacked'$$, '42501', null::text, 'audit no se actualiza');
select throws_ok($$delete from public.audit_log$$, '42501', null::text, 'audit no se borra');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"user1@test.invalid","role":"authenticated"}';
select results_eq($$select count(*) from public.audit_log where action like 'role.%'$$, array[4::bigint], 'filas audit intactas');
select is_empty($$select * from public.audit_log where organization_id='10000000-0000-0000-0000-000000000002'$$, 'owner A no lee B');
select throws_ok($$insert into public.audit_log(organization_id,actor_kind,action,entity,entity_id) values ('10000000-0000-0000-0000-000000000002','user','test.insert','test','1')$$, '42501', null::text, 'owner A no escribe audit B');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"user6@test.invalid","role":"authenticated"}';
select throws_ok($$insert into public.audit_log(organization_id,actor_kind,action,entity,entity_id) values ('10000000-0000-0000-0000-000000000001','user','test.insert','test','1')$$, '42501', null::text, 'no miembro no escribe audit');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"user5@test.invalid","role":"authenticated"}';
select results_eq($$select count(*) from public.audit_log where organization_id='10000000-0000-0000-0000-000000000002'$$, array[1::bigint], 'audit B intacto');
reset role;
select * from finish();
rollback;
