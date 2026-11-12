-- Los puntos 4 (FKs compuestas), 5 (vistas) y 6 (storage) no aplican al núcleo.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(48);
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
select throws_ok($$select * from public.invitations$$, '42501', null::text, 'anon: select denegado');
select throws_ok($$insert into public.invitations(organization_id,email,role,token_hash,created_by) values ('10000000-0000-0000-0000-000000000001','new@test.invalid','viewer',repeat('c',64),'00000000-0000-0000-0000-000000000001')$$, '42501', null::text, 'anon: insert denegado');
select throws_ok($$update public.invitations set role = 'viewer'$$, '42501', null::text, 'anon: update denegado');
select throws_ok($$delete from public.invitations$$, '42501', null::text, 'anon: delete denegado');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"user1@test.invalid","role":"authenticated"}';
select results_eq($$select count(*) from public.invitations$$, array[1::bigint], 'rol 1: visibilidad invitaciones');
select results_eq($$insert into public.invitations(organization_id,email,role,token_hash,created_by) values ('10000000-0000-0000-0000-000000000001','new@test.invalid','viewer',repeat('c',64),'00000000-0000-0000-0000-000000000001') returning role::text$$, array['viewer'::text], 'gestor invita');
select results_eq($$update public.invitations set role='analyst' where email='new@test.invalid' returning role::text$$, array['analyst'::text], 'gestor actualiza invitación');
select results_eq($$delete from public.invitations where email='new@test.invalid' returning email$$, array['new@test.invalid'::text], 'gestor borra invitación');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"user2@test.invalid","role":"authenticated"}';
select results_eq($$select count(*) from public.invitations$$, array[1::bigint], 'rol 2: visibilidad invitaciones');
select results_eq($$insert into public.invitations(organization_id,email,role,token_hash,created_by) values ('10000000-0000-0000-0000-000000000001','new@test.invalid','viewer',repeat('c',64),'00000000-0000-0000-0000-000000000001') returning role::text$$, array['viewer'::text], 'gestor invita');
select results_eq($$update public.invitations set role='analyst' where email='new@test.invalid' returning role::text$$, array['analyst'::text], 'gestor actualiza invitación');
select results_eq($$delete from public.invitations where email='new@test.invalid' returning email$$, array['new@test.invalid'::text], 'gestor borra invitación');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"user3@test.invalid","role":"authenticated"}';
select results_eq($$select count(*) from public.invitations$$, array[0::bigint], 'rol 3: visibilidad invitaciones');
select throws_ok($$insert into public.invitations(organization_id,email,role,token_hash,created_by) values ('10000000-0000-0000-0000-000000000001','new@test.invalid','viewer',repeat('c',64),'00000000-0000-0000-0000-000000000001')$$, '42501', null::text, 'lector no invita');
select is_empty($$update public.invitations set role='admin' where organization_id='10000000-0000-0000-0000-000000000001' returning id$$, 'lector no actualiza');
select is_empty($$delete from public.invitations where organization_id='10000000-0000-0000-0000-000000000001' returning id$$, 'lector no borra');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","email":"user4@test.invalid","role":"authenticated"}';
select results_eq($$select count(*) from public.invitations$$, array[0::bigint], 'rol 4: visibilidad invitaciones');
select throws_ok($$insert into public.invitations(organization_id,email,role,token_hash,created_by) values ('10000000-0000-0000-0000-000000000001','new@test.invalid','viewer',repeat('c',64),'00000000-0000-0000-0000-000000000001')$$, '42501', null::text, 'lector no invita');
select is_empty($$update public.invitations set role='admin' where organization_id='10000000-0000-0000-0000-000000000001' returning id$$, 'lector no actualiza');
select is_empty($$delete from public.invitations where organization_id='10000000-0000-0000-0000-000000000001' returning id$$, 'lector no borra');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"user2@test.invalid","role":"authenticated"}';
select throws_ok($$insert into public.invitations(organization_id,email,role,token_hash,created_by) values ('10000000-0000-0000-0000-000000000001','new@test.invalid','owner',repeat('c',64),'00000000-0000-0000-0000-000000000001')$$, '42501', null::text, 'admin no invita owner');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"user1@test.invalid","role":"authenticated"}';
select results_eq($$select role::text from public.invitations where organization_id='10000000-0000-0000-0000-000000000001'$$, array['analyst'::text], 'invitación intacta');
select throws_ok($$insert into public.invitations(organization_id,email,role,token_hash,created_by) values ('10000000-0000-0000-0000-000000000002','new@test.invalid','viewer',repeat('c',64),'00000000-0000-0000-0000-000000000001')$$, '42501', null::text, 'owner A no invita en B');
select is_empty($$select * from public.invitations where organization_id='10000000-0000-0000-0000-000000000002'$$, 'owner A no lee B');
select is_empty($$update public.invitations set role='admin' where organization_id='10000000-0000-0000-0000-000000000002' returning id$$, 'owner A no actualiza B');
select is_empty($$delete from public.invitations where organization_id='10000000-0000-0000-0000-000000000002' returning id$$, 'owner A no borra B');
select throws_ok($$insert into public.invitations(organization_id,email,role,token_hash,created_by) values ('10000000-0000-0000-0000-000000000001','USER6@test.invalid','viewer',repeat('c',64),'00000000-0000-0000-0000-000000000001')$$, '23505', null::text, 'pendiente única sin distinguir mayúsculas');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"user5@test.invalid","role":"authenticated"}';
select results_eq($$select role::text from public.invitations where organization_id='10000000-0000-0000-0000-000000000002'$$, array['viewer'::text], 'B intacta');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"user1@test.invalid","role":"authenticated"}';
select throws_ok($$select public.accept_invitation('token-a')$$, '42501', null::text, 'correo ajeno no acepta');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"user6@test.invalid","role":"authenticated"}';
select throws_ok($$select public.accept_invitation('wrong')$$, '42501', null::text, 'token inválido');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"USER6@test.invalid","role":"authenticated"}';
select results_eq($$select public.accept_invitation('token-a')$$, array['10000000-0000-0000-0000-000000000001'::uuid], 'acepta con correo en mayúsculas');
select results_eq($$select role::text from public.memberships where organization_id='10000000-0000-0000-0000-000000000001' and user_id='00000000-0000-0000-0000-000000000006'$$, array['analyst'::text], 'aceptación crea miembro');
select throws_ok($$select public.accept_invitation('token-a')$$, '42501', null::text, 'token no se reutiliza');
reset role;
select results_eq($$select accepted_at is not null from public.invitations where organization_id='10000000-0000-0000-0000-000000000001'$$, array[true], 'marca aceptada');
select results_eq($$select count(*) from public.audit_log where action='invitation.accepted' and organization_id='10000000-0000-0000-0000-000000000001'$$, array[1::bigint], 'audita aceptación');
update public.invitations set expires_at=now()-interval '1 second' where organization_id='10000000-0000-0000-0000-000000000002';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"user6@test.invalid","role":"authenticated"}';
select throws_ok($$select public.accept_invitation('token-b')$$, '42501', null::text, 'token caducado');
reset role;
update public.invitations set expires_at=now()+interval '1 day' where organization_id='10000000-0000-0000-0000-000000000002';
insert into public.memberships values ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000006','admin',now());
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"user6@test.invalid","role":"authenticated"}';
select results_eq($$select public.accept_invitation('token-b')$$, array['10000000-0000-0000-0000-000000000002'::uuid], 'miembro existente acepta');
select results_eq($$select role::text from public.memberships where organization_id='10000000-0000-0000-0000-000000000002' and user_id='00000000-0000-0000-0000-000000000006'$$, array['admin'::text], 'invitación nunca degrada');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"user1@test.invalid","role":"authenticated"}';
select results_eq($$insert into public.invitations(organization_id,email,role,token_hash,created_by) values ('10000000-0000-0000-0000-000000000001','future-owner@test.invalid','owner',repeat('d',64),'00000000-0000-0000-0000-000000000001') returning role::text$$,array['owner'::text],'owner puede invitar owner');
select results_eq($$select expires_at = now()+interval '7 days' from public.invitations where email='future-owner@test.invalid'$$,array[true],'caducidad predeterminada siete días');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"user2@test.invalid","role":"authenticated"}';
select is_empty($$update public.invitations set role='viewer' where email='future-owner@test.invalid' returning id$$,'admin no modifica invitación owner');
select is_empty($$delete from public.invitations where email='future-owner@test.invalid' returning id$$,'admin no borra invitación owner');
select throws_ok($$update public.invitations set role='owner' where email='user6@test.invalid'$$,'42501',null::text,'admin no eleva invitación a owner');
select throws_ok($$update public.invitations set accepted_at=now()$$,'42501',null::text,'aceptación solo por RPC');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"user1@test.invalid","role":"authenticated"}';
select results_eq($$select role::text from public.invitations where email='future-owner@test.invalid'$$,array['owner'::text],'invitación owner intacta');
select results_eq($$delete from public.invitations where email='future-owner@test.invalid' returning role::text$$,array['owner'::text],'owner borra invitación owner');
set local role anon;
select throws_ok($$select public.accept_invitation('token-a')$$,'42501',null::text,'anon no acepta');
set local role authenticated;
set local request.jwt.claims = '{}';
select throws_ok($$select public.accept_invitation('token-a')$$,'42501',null::text,'aceptación exige usuario');
reset role;
select * from finish();
rollback;
