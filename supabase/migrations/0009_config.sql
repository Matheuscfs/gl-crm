-- Configurações persistidas + régua de comunicação.

create table if not exists public.clinic_settings (
  key      text primary key default 'clinic',
  name     text,
  cro      text,
  cnpj     text,
  address  text,
  phone    text
);

create table if not exists public.schedule_hours (
  day      text primary key,
  hours    text,
  closed   boolean default false,
  ord      int default 0
);

create table if not exists public.team_users (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  role      text,
  initials  text,
  created_at timestamptz default now()
);

create table if not exists public.regua_rules (
  rule_id   text primary key,
  title     text,
  whn       text,
  is_on     boolean default true,
  perfil    text default 'pediatrico',
  ord       int default 0
);

do $$
declare t text;
begin
  foreach t in array array['clinic_settings','schedule_hours','team_users','regua_rules']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "prototype_all" on public.%I;', t);
    execute format('create policy "prototype_all" on public.%I for all to anon, authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- valores iniciais
insert into public.clinic_settings (key, name, cro, cnpj, address, phone)
values ('clinic', 'Consultório Dra. Gabriela Lorenzi', 'CRO 39889', '00.000.000/0001-00', 'Cascavel-PR', '(45) 90000-0000')
on conflict (key) do nothing;

insert into public.schedule_hours (day, hours, closed, ord) values
  ('Segunda','08:00 – 18:00',false,1),('Terça','08:00 – 18:00',false,2),('Quarta','08:00 – 18:00',false,3),
  ('Quinta','08:00 – 18:00',false,4),('Sexta','08:00 – 17:00',false,5),('Sábado','08:00 – 12:00',false,6),('Domingo','Fechado',true,7)
on conflict (day) do nothing;

insert into public.team_users (name, role, initials) values
  ('Dra. Gabriela Lorenzi','Cirurgiã Dentista · Admin','GL'),
  ('Camila Souza','Recepção','CS'),
  ('Bruna Teixeira','Auxiliar de saúde bucal','BT')
on conflict do nothing;
