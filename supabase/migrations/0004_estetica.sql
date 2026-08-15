-- Recursos estéticos: perfil nos agendamentos, mapa facial e marcadores de aplicação.
-- Rode se já tinha aplicado o 0001 sem estas colunas/tabelas.

-- perfil do agendamento
alter table public.appointments
  add column if not exists kind text default 'ped';

-- mapa facial (unidades por zona, por paciente)
create table if not exists public.facial_map (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete cascade,
  zone        text not null,
  units       int default 0,
  created_at  timestamptz default now(),
  unique (patient_id, zone)
);

-- marcadores de aplicação sobre a foto (Antes/Depois)
create table if not exists public.aesthetic_markers (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete cascade,
  region      text not null,
  units       int default 0,
  x           numeric default 50,
  y           numeric default 50,
  angle       text default 'Frontal',
  created_at  timestamptz default now()
);

-- sessões fotográficas
create table if not exists public.photo_sessions (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete cascade,
  session_date text,
  label       text,
  created_at  timestamptz default now()
);

do $$
declare t text;
begin
  foreach t in array array['facial_map','aesthetic_markers','photo_sessions']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "prototype_all" on public.%I;', t);
    execute format('create policy "prototype_all" on public.%I for all to anon, authenticated using (true) with check (true);', t);
  end loop;
end $$;
