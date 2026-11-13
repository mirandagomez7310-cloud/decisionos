-- Los puntos 4 (FKs compuestas), 5 (vistas) y 6 (storage) no aplican al núcleo.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(42);
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
select throws_ok($$select * from public.memberships$$, '42501', null::text, 'anon: select denegado');
select throws_ok($$insert into public.memberships(organization_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','viewer')$$, '42501', null::text, 'anon: insert denegado');
select throws_ok($$update public.memberships set role = 'viewer'$$, '42501', null::text, 'anon: update denegado');
select throws_ok($$delete from public.memberships$$, '42501', null::text, 'anon: delete denegado');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"user1@test.invalid","role":"authenticated"}';
select results_eq($$select count(*) from public.memberships$$, array[4::bigint], 'rol 1: ve miembros A');
select throws_ok($$insert into public.memberships(organization_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','viewer')$$, '42501', null::text, 'gestor inserta miembro: denegado');
reset role;
insert into public.memberships(organization_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','viewer');
set local role authenticated;
select results_eq($$update public.memberships set role='analyst' where user_id='00000000-0000-0000-0000-000000000006' returning role::text$$, array['analyst'::text], 'gestor cambia rol');
select results_eq($$delete from public.memberships where user_id='00000000-0000-0000-0000-000000000006' returning user_id::text$$, array['00000000-0000-0000-0000-000000000006'::text], 'gestor borra miembro');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"user2@test.invalid","role":"authenticated"}';
select results_eq($$select count(*) from public.memberships$$, array[4::bigint], 'rol 2: ve miembros A');
select throws_ok($$insert into public.memberships(organization_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','viewer')$$, '42501', null::text, 'gestor inserta miembro: denegado');
reset role;
insert into public.memberships(organization_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','viewer');
set local role authenticated;
select results_eq($$update public.memberships set role='analyst' where user_id='00000000-0000-0000-0000-000000000006' returning role::text$$, array['analyst'::text], 'gestor cambia rol');
select results_eq($$delete from public.memberships where user_id='00000000-0000-0000-0000-000000000006' returning user_id::text$$, array['00000000-0000-0000-0000-000000000006'::text], 'gestor borra miembro');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"user3@test.invalid","role":"authenticated"}';
select results_eq($$select count(*) from public.memberships$$, array[4::bigint], 'rol 3: ve miembros A');
select throws_ok($$insert into public.memberships(organization_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','viewer')$$, '42501', null::text, 'lector no inserta');
select is_empty($$update public.memberships set role='admin' where user_id='00000000-0000-0000-0000-000000000003' returning user_id$$, 'lector no escala');
select is_empty($$delete from public.memberships where user_id='00000000-0000-0000-0000-000000000003' returning user_id$$, 'lector no se borra');
select results_eq($$select role::text from public.memberships where user_id='00000000-0000-0000-0000-000000000003'$$, array['analyst'::text], 'rol intacto');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","email":"user4@test.invalid","role":"authenticated"}';
select results_eq($$select count(*) from public.memberships$$, array[4::bigint], 'rol 4: ve miembros A');
select throws_ok($$insert into public.memberships(organization_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','viewer')$$, '42501', null::text, 'lector no inserta');
select is_empty($$update public.memberships set role='admin' where user_id='00000000-0000-0000-0000-000000000004' returning user_id$$, 'lector no escala');
select is_empty($$delete from public.memberships where user_id='00000000-0000-0000-0000-000000000004' returning user_id$$, 'lector no se borra');
select results_eq($$select role::text from public.memberships where user_id='00000000-0000-0000-0000-000000000004'$$, array['viewer'::text], 'rol intacto');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"user2@test.invalid","role":"authenticated"}';
select throws_ok($$insert into public.memberships(organization_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','owner')$$, '42501', null::text, 'admin no crea owner');
select throws_ok($$update public.memberships set role='owner' where user_id='00000000-0000-0000-0000-000000000003'$$, '42501', null::text, 'admin no promueve a owner');
select is_empty($$update public.memberships set role='viewer' where user_id='00000000-0000-0000-0000-000000000001' returning user_id$$, 'admin no degrada owner');
select is_empty($$delete from public.memberships where user_id='00000000-0000-0000-0000-000000000001' returning user_id$$, 'admin no borra owner');
select results_eq($$select role::text from public.memberships where user_id='00000000-0000-0000-0000-000000000001'$$, array['owner'::text], 'owner intacto');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"user1@test.invalid","role":"authenticated"}';
select throws_ok($$update public.memberships set role='admin' where user_id='00000000-0000-0000-0000-000000000001'$$, '23514', null::text, 'último owner no se degrada');
select throws_ok($$delete from public.memberships where user_id='00000000-0000-0000-0000-000000000001'$$, '23514', null::text, 'último owner no se borra');
select throws_ok($$insert into public.memberships(organization_id,user_id,role) values ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000006','viewer')$$, '42501', null::text, 'owner A no inserta en B');
select is_empty($$select * from public.memberships where organization_id='10000000-0000-0000-0000-000000000002'$$, 'owner A no lee B');
select is_empty($$update public.memberships set role='viewer' where organization_id='10000000-0000-0000-0000-000000000002' returning user_id$$, 'owner A no actualiza B');
select is_empty($$delete from public.memberships where organization_id='10000000-0000-0000-0000-000000000002' returning user_id$$, 'owner A no borra B');
select throws_ok($$insert into public.memberships(organization_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','owner')$$, '42501', null::text, 'owner crea segundo owner: denegado');
reset role;
insert into public.memberships(organization_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000006','owner');
set local role authenticated;
select results_eq($$update public.memberships set role='admin' where user_id='00000000-0000-0000-0000-000000000001' returning role::text$$, array['admin'::text], 'con segundo owner sí se degrada');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"user6@test.invalid","role":"authenticated"}';
select results_eq($$delete from public.memberships where user_id='00000000-0000-0000-0000-000000000001' returning role::text$$, array['admin'::text], 'owner borra ex owner');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"user5@test.invalid","role":"authenticated"}';
select results_eq($$select role::text from public.memberships where organization_id='10000000-0000-0000-0000-000000000002'$$, array['owner'::text], 'B intacta');
reset role;
select results_eq($$select count(*) from public.audit_log where organization_id='10000000-0000-0000-0000-000000000001' and action in ('membership.insert','membership.update','membership.delete') and data ? 'old' and data ? 'new'$$, array[13::bigint], 'auditoría cubre altas, cambios y bajas');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"user6@test.invalid","role":"authenticated"}';
select throws_ok($$update public.memberships set organization_id='10000000-0000-0000-0000-000000000002' where organization_id='10000000-0000-0000-0000-000000000001' and user_id='00000000-0000-0000-0000-000000000006'$$,'42501',null::text,'no traslada membresías');
select results_eq($$delete from public.memberships where user_id='00000000-0000-0000-0000-000000000004' returning role::text$$,array['viewer'::text],'owner revoca acceso');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","email":"user4@test.invalid","role":"authenticated"}';
select is_empty($$select * from public.organizations$$,'revocación surte efecto sin cambiar JWT');
select is_empty($$select * from public.memberships$$,'ex miembro no ve miembros');
reset role;
select * from finish();
rollback;
