-- Los puntos 4 (FKs compuestas), 5 (vistas) y 6 (storage) no aplican al núcleo.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(35);
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
select throws_ok($$select * from public.organizations$$, '42501', null::text, 'anon: select denegado');
select throws_ok($$insert into public.organizations(name,slug) values ('Anon','anon')$$, '42501', null::text, 'anon: insert denegado');
select throws_ok($$update public.organizations set name = 'hacked'$$, '42501', null::text, 'anon: update denegado');
select throws_ok($$delete from public.organizations$$, '42501', null::text, 'anon: delete denegado');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"user1@test.invalid","role":"authenticated"}';
select results_eq($$select name from public.organizations order by name$$, array['Tenant A'::text], 'rol 1: solo lee A');
select results_eq($$update public.organizations set name = 'Tenant A' where id = '10000000-0000-0000-0000-000000000001' returning name$$, array['Tenant A'::text], 'rol 1: actualiza A');
select throws_ok($$insert into public.organizations(name,slug) values ('Direct','direct')$$, '42501', null::text, 'sin creación directa');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","email":"user2@test.invalid","role":"authenticated"}';
select results_eq($$select name from public.organizations order by name$$, array['Tenant A'::text], 'rol 2: solo lee A');
select results_eq($$update public.organizations set name = 'Tenant A' where id = '10000000-0000-0000-0000-000000000001' returning name$$, array['Tenant A'::text], 'rol 2: actualiza A');
select is_empty($$delete from public.organizations where id = '10000000-0000-0000-0000-000000000001' returning id$$, 'rol 2: no borra A');
select throws_ok($$insert into public.organizations(name,slug) values ('Direct','direct')$$, '42501', null::text, 'sin creación directa');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","email":"user3@test.invalid","role":"authenticated"}';
select results_eq($$select name from public.organizations order by name$$, array['Tenant A'::text], 'rol 3: solo lee A');
select is_empty($$update public.organizations set name = 'Hacked' where id = '10000000-0000-0000-0000-000000000001' returning id$$, 'rol 3: no actualiza');
select results_eq($$select name from public.organizations where id = '10000000-0000-0000-0000-000000000001'$$, array['Tenant A'::text], 'fila intacta');
select is_empty($$delete from public.organizations where id = '10000000-0000-0000-0000-000000000001' returning id$$, 'rol 3: no borra A');
select throws_ok($$insert into public.organizations(name,slug) values ('Direct','direct')$$, '42501', null::text, 'sin creación directa');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","email":"user4@test.invalid","role":"authenticated"}';
select results_eq($$select name from public.organizations order by name$$, array['Tenant A'::text], 'rol 4: solo lee A');
select is_empty($$update public.organizations set name = 'Hacked' where id = '10000000-0000-0000-0000-000000000001' returning id$$, 'rol 4: no actualiza');
select results_eq($$select name from public.organizations where id = '10000000-0000-0000-0000-000000000001'$$, array['Tenant A'::text], 'fila intacta');
select is_empty($$delete from public.organizations where id = '10000000-0000-0000-0000-000000000001' returning id$$, 'rol 4: no borra A');
select throws_ok($$insert into public.organizations(name,slug) values ('Direct','direct')$$, '42501', null::text, 'sin creación directa');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"user1@test.invalid","role":"authenticated"}';
select is_empty($$update public.organizations set name = 'Hacked' where id = '10000000-0000-0000-0000-000000000002' returning id$$, 'owner A no actualiza B');
select is_empty($$delete from public.organizations where id = '10000000-0000-0000-0000-000000000002' returning id$$, 'owner A no borra B');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000005","email":"user5@test.invalid","role":"authenticated"}';
select results_eq($$select name from public.organizations where id = '10000000-0000-0000-0000-000000000002'$$, array['Tenant B'::text], 'B intacta');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000006","email":"user6@test.invalid","role":"authenticated"}';
select results_eq($$select (public.create_organization('Created','created')).slug$$, array['created'::text], 'RPC crea organización');
select results_eq($$select role::text from public.memberships where user_id = '00000000-0000-0000-0000-000000000006'$$, array['owner'::text], 'RPC crea owner');
select results_eq($$select count(*) from public.audit_log where action = 'organization.created'$$, array[1::bigint], 'RPC audita creación');
select throws_ok($$select public.create_organization('Duplicate','created')$$, '23505', null::text, 'slug único');
select throws_ok($$select public.create_organization('Invalid','UPPER')$$, '23514', null::text, 'slug inválido');
select results_eq($$delete from public.organizations where slug = 'created' returning slug$$, array['created'::text], 'owner borra organización con cascada');
reset role;
select results_eq($$select count(*) from public.organizations where slug = 'created'$$, array[0::bigint], 'organización borrada');
set local role authenticated;
set local request.jwt.claims = '{}';
select throws_ok($$select public.create_organization('No user','no-user')$$, '42501', null::text, 'RPC exige usuario');
set local role anon;
select throws_ok($$select public.create_organization('Anon','anon-rpc')$$,'42501',null::text,'anon no ejecuta RPC');
reset role;
update public.organizations set updated_at='2000-01-01' where id='10000000-0000-0000-0000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","email":"user1@test.invalid","role":"authenticated"}';
select throws_ok($$update public.organizations set id='10000000-0000-0000-0000-000000000002' where id='10000000-0000-0000-0000-000000000001'$$,'42501',null::text,'identidad de organización inmutable');
select results_eq($$update public.organizations set name='Tenant A' where id='10000000-0000-0000-0000-000000000001' returning updated_at = now()$$,array[true],'trigger actualiza updated_at');
reset role;
select * from finish();
rollback;
