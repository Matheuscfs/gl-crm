-- Agenda com datas reais: coluna date (ISO) nos agendamentos.
alter table public.appointments
  add column if not exists date text;
