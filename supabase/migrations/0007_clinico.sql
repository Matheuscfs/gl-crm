-- Fundação clínica: cadastro completo de paciente + tabelas de anamnese,
-- tratamentos e planos de orçamento. Rode no SQL Editor.

-- ---------- Paciente: campos completos ----------
alter table public.patients
  add column if not exists birthdate  date,
  add column if not exists sex        text,
  add column if not exists cpf        text,
  add column if not exists phone      text,
  add column if not exists resp_cpf   text,
  add column if not exists resp_phone text,
  add column if not exists convenio   text,
  add column if not exists prontuario text;

-- ---------- Anamnese (1 registro por paciente, campos em JSON) ----------
create table if not exists public.anamnese (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete cascade unique,
  data        jsonb default '{}'::jsonb,
  updated_at  timestamptz default now()
);

-- ---------- Tratamentos executados (timeline) ----------
create table if not exists public.treatments (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete cascade,
  treat_date  text,
  proc        text,
  prof        text,
  frankl      int,
  note        text,
  created_at  timestamptz default now()
);

-- ---------- Planos de tratamento / orçamento ----------
create table if not exists public.plans (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete cascade unique,
  status      text default 'aguardando',
  discount    numeric default 0,
  created_at  timestamptz default now()
);

create table if not exists public.plan_items (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete cascade,
  dente       text,
  face        text,
  regiao      text,
  proc        text,
  qtd         text,
  val         numeric default 0,
  created_at  timestamptz default now()
);

-- ---------- RLS de protótipo ----------
do $$
declare t text;
begin
  foreach t in array array['anamnese','treatments','plans','plan_items']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "prototype_all" on public.%I;', t);
    execute format('create policy "prototype_all" on public.%I for all to anon, authenticated using (true) with check (true);', t);
  end loop;
end $$;
