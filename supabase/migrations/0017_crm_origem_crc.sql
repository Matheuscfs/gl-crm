-- CRM: origem do lead (canal de captação) + status das oportunidades do CRC.

alter table public.leads add column if not exists origem text;

create table if not exists public.crc_status (
  opp_key   text primary key,
  stage     int default 0,
  created_at timestamptz default now()
);

do $$
declare t text;
begin
  foreach t in array array['crc_status']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "prototype_all" on public.%I;', t);
    execute format('create policy "prototype_all" on public.%I for all to anon, authenticated using (true) with check (true);', t);
  end loop;
end $$;
