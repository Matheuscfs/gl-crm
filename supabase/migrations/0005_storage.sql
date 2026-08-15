-- Storage para fotos do Antes/Depois.
-- Rode no SQL Editor do projeto.

-- 1) Bucket público
insert into storage.buckets (id, name, public)
values ('patient-photos', 'patient-photos', true)
on conflict (id) do nothing;

-- 2) Políticas de protótipo no storage (anon pode gerenciar objetos deste bucket)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'pp_read') then
    create policy "pp_read" on storage.objects for select to anon, authenticated using (bucket_id = 'patient-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'pp_write') then
    create policy "pp_write" on storage.objects for insert to anon, authenticated with check (bucket_id = 'patient-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'pp_update') then
    create policy "pp_update" on storage.objects for update to anon, authenticated using (bucket_id = 'patient-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'pp_delete') then
    create policy "pp_delete" on storage.objects for delete to anon, authenticated using (bucket_id = 'patient-photos');
  end if;
end $$;

-- 3) Registro das URLs por paciente / ângulo / slot
create table if not exists public.patient_photos (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete cascade,
  angle       text,
  slot        text,   -- 'before' | 'after'
  url         text,
  created_at  timestamptz default now(),
  unique (patient_id, angle, slot)
);

alter table public.patient_photos enable row level security;
drop policy if exists "prototype_all" on public.patient_photos;
create policy "prototype_all" on public.patient_photos for all to anon, authenticated using (true) with check (true);
