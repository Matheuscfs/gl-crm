-- Adiciona o perfil do paciente (pediátrico × estético).
-- Rode apenas se você já tinha aplicado o 0001_init.sql sem a coluna perfil.

alter table public.patients
  add column if not exists perfil text default 'pediatrico';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'patients_perfil_check'
  ) then
    alter table public.patients
      add constraint patients_perfil_check check (perfil in ('pediatrico', 'estetico', 'adulto'));
  end if;
end $$;
