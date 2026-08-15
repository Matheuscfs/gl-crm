-- Duração e valor numéricos nos procedimentos (antes texto livre "40 min" / "R$ 180,00").
-- As colunas de texto dur/val são mantidas por compatibilidade e continuam gravadas pelo app.

alter table public.procedures add column if not exists dur_min int;
alter table public.procedures add column if not exists valor numeric(10,2);

-- backfill a partir dos textos legados
update public.procedures
  set dur_min = nullif(regexp_replace(coalesce(dur, ''), '\D', '', 'g'), '')::int
  where dur_min is null;

update public.procedures
  set valor = nullif(replace(regexp_replace(coalesce(val, ''), '[^0-9,]', '', 'g'), ',', '.'), '')::numeric(10,2)
  where valor is null;
