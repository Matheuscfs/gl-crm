-- CRM Odontopediátrico — schema inicial
-- Espelha as entidades usadas no front-end (src/store.tsx e src/data.ts).
-- Datas/rótulos ficam como text por ora para a integração ser 1:1 com a UI atual;
-- podem ser normalizados (date/timestamptz/numeric) numa migração posterior.

create extension if not exists "pgcrypto";

-- ---------- Pacientes ----------
create table if not exists public.patients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  age         text,
  resp        text,
  last        text,
  next        text,
  tipo        text default 'Particular' check (tipo in ('Particular', 'Convênio')),
  status      text default 'lead',
  perfil      text default 'pediatrico' check (perfil in ('pediatrico', 'estetico', 'adulto')),
  late        boolean default false,
  initials    text,
  prontuario  text,
  birthdate   date,
  created_at  timestamptz default now()
);

-- ---------- Responsáveis ----------
create table if not exists public.responsaveis (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete cascade,
  name        text not null,
  rel         text,
  phone       text,
  is_main     boolean default false,
  created_at  timestamptz default now()
);

-- ---------- Agendamentos ----------
create table if not exists public.appointments (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete set null,
  child       text not null,
  age         text,
  proc        text,
  resp        text,
  status      text default 'agendado',
  kind        text default 'ped',   -- 'ped' | 'est'
  day         int  default 0,       -- 0..5 (grade semanal atual)
  "start"     numeric default 9,    -- hora (8..18)
  dur         numeric default 1,
  created_at  timestamptz default now()
);

-- ---------- CRM: leads / funil ----------
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  resp        text,
  info        text,
  stage       int default 0,
  created_at  timestamptz default now()
);

-- ---------- Estoque ----------
create table if not exists public.stock_items (
  id          uuid primary key default gen_random_uuid(),
  item        text not null,
  cat         text,
  un          text,
  qtd         int default 0,
  min         int default 0,
  status      text default 'ok',
  ent         text,
  created_at  timestamptz default now()
);

-- ---------- Procedimentos (tabela de preços) ----------
create table if not exists public.procedures (
  id          uuid primary key default gen_random_uuid(),
  proc        text not null,
  cat         text,
  dur         text,
  val         text,
  created_at  timestamptz default now()
);

-- ---------- Modelos de mensagem ----------
create table if not exists public.message_templates (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  created_at  timestamptz default now()
);

-- ---------- Documentos da ficha ----------
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete cascade,
  name        text not null,
  kind        text,
  doc_date    text,
  created_at  timestamptz default now()
);

-- ---------- Odontograma (estado por dente) ----------
create table if not exists public.teeth (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete cascade,
  num         int not null,
  state       text default 'higido',
  created_at  timestamptz default now(),
  unique (patient_id, num)
);

-- ---------- Parcelas / financeiro ----------
create table if not exists public.installments (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete set null,
  resp        text,
  ref         text,
  venc        text,
  val         text,
  status      text default 'aberto',
  created_at  timestamptz default now()
);

-- ---------- RLS ----------
-- ATENÇÃO: políticas de protótipo — liberam acesso total às roles anon/authenticated.
-- Antes de produção, substitua por políticas baseadas em auth (ex.: por clínica/usuário).
do $$
declare t text;
begin
  foreach t in array array[
    'patients','responsaveis','appointments','leads','stock_items',
    'procedures','message_templates','documents','teeth','installments'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "prototype_all" on public.%I;', t);
    execute format(
      'create policy "prototype_all" on public.%I for all to anon, authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;
