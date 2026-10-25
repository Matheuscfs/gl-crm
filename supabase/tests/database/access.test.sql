-- Who can see and change what, as enforced by the database (migrations 0025–0028).
--
-- Each block switches to the role and JWT claims Supabase would set for a real request:
-- `anon` for someone without an account, `authenticated` with an e-mail claim for a signed-in
-- user. Everything runs in one transaction that is rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- Act as a signed-in user. RESET ROLE first so the helper always runs as the test owner.
create function pg_temp.sign_in(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', md5(p_email)::uuid, 'email', p_email, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.sign_out() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

-- ------------------------------------------------------------------ schema-wide guarantees

select is_empty(
  $$ select tablename from pg_tables where schemaname = 'public' and not rowsecurity $$,
  'row level security is on for every table in public'
);

select has_function('public', 'minha_situacao', 'the access check exists');

-- ------------------------------------------------------------------ no account (anon)

select pg_temp.sign_out();

select throws_ok($$ select count(*) from public.patients $$, '42501', null,
  'anon cannot read patients');
select throws_ok($$ insert into public.patients (name) values ('Intruso') $$, '42501', null,
  'anon cannot create patients');
select throws_ok($$ select count(*) from public.solicitacoes_agendamento $$, '42501', null,
  'anon cannot read booking requests');
select lives_ok($$ select * from public.horarios_livres(current_date + 1, current_date + 14) $$,
  'anon can list free slots for online booking');

-- ------------------------------------------------------------------ first sign-in becomes admin

reset role;
select pg_temp.sign_in('dra@clinica.test');

select is(public.minha_situacao(), 'admin', 'the first person to sign in becomes admin');
select ok((select count(*) from public.patients) > 0, 'the admin reads the patients');

-- ------------------------------------------------------------------ signed up but not on the team

reset role;
select pg_temp.sign_in('curioso@exemplo.test');

select is(public.minha_situacao(), 'pendente', 'a stranger with an account is pending');
select is((select count(*) from public.patients)::int, 0, 'a pending user sees no patients');
select throws_ok($$ insert into public.patients (name) values ('Intruso') $$, '42501', null,
  'a pending user cannot create patients');
select throws_ok($$ insert into public.team_users (name, email) values ('Eu', 'curioso@exemplo.test') $$, '42501', null,
  'a pending user cannot add themselves to the team');
select is((select count(*) from public.audit_log)::int, 0, 'a pending user sees no audit history');

-- ------------------------------------------------------------------ team member

reset role;
select pg_temp.sign_in('dra@clinica.test');
select lives_ok(
  $$ insert into public.team_users (name, role, email) values ('Camila', 'Recepção', 'camila@clinica.test') $$,
  'the admin adds a team member');

reset role;
select pg_temp.sign_in('camila@clinica.test');

select is(public.minha_situacao(), 'equipe', 'a listed e-mail is team');
select lives_ok($$ insert into public.patients (name) values ('Paciente Teste') $$,
  'a team member creates a patient');
select is((select count(*) from public.patients where name = 'Paciente Teste')::int, 1,
  'and reads it back');
select throws_ok($$ insert into public.team_users (name, email) values ('Amiga', 'amiga@exemplo.test') $$, '42501', null,
  'only the admin manages the team');
select ok(
  exists (select 1 from public.audit_log where tabela = 'patients' and acao = 'INSERT' and email = 'camila@clinica.test'),
  'the insert is in the audit log under her e-mail');
select throws_ok($$ insert into public.audit_log (tabela, acao) values ('patients', 'DELETE') $$, '42501', null,
  'nobody writes the audit log by hand');

insert into public.evolucoes (patient_id, note)
select id, 'evolução de teste' from public.patients where name = 'Paciente Teste';
select throws_ok($$ delete from public.evolucoes where note = 'evolução de teste' $$, 'P0001', null,
  'a clinical note cannot be deleted, only voided');
select lives_ok($$ delete from public.patients where name = 'Paciente Teste' $$,
  'deleting the whole patient still cascades to their notes');

-- ------------------------------------------------------------------ removed from the team

reset role;
select pg_temp.sign_in('dra@clinica.test');
update public.team_users set ativo = false where email = 'camila@clinica.test';

reset role;
select pg_temp.sign_in('camila@clinica.test');
select is((select count(*) from public.patients)::int, 0, 'a deactivated member loses access at once');
select is(public.minha_situacao(), 'pendente', 'and is pending again');

-- ------------------------------------------------------------------ online booking

reset role;
select pg_temp.sign_out();

select lives_ok($$
  select public.solicitar_agendamento('Carla Souza', '(45) 98888-1111', 'Ana Souza', null,
    (select dia from public.horarios_livres(current_date + 1, current_date + 14) limit 1),
    (select hora from public.horarios_livres(current_date + 1, current_date + 14) limit 1),
    'Consulta', null)
$$, 'anon can request a free slot');
select throws_ok($$
  select public.solicitar_agendamento('Carla Souza', '123', 'Ana Souza', null, current_date + 1, 9, 'Consulta', null)
$$, 'P0001', 'Telefone incompleto.', 'a request with an incomplete phone is refused');

select * from finish();
rollback;
