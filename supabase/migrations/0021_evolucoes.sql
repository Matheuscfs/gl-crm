-- Ficha de Evolução: registros clínicos narrativos por sessão (aba própria na ficha do paciente).

create table if not exists public.evolucoes (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete cascade,
  evo_date    text,
  proc        text,
  prof        text,
  note        text,
  created_at  timestamptz default now()
);

do $$
declare t text;
begin
  foreach t in array array['evolucoes']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "prototype_all" on public.%I;', t);
    execute format('create policy "prototype_all" on public.%I for all to anon, authenticated using (true) with check (true);', t);
  end loop;
end $$;
