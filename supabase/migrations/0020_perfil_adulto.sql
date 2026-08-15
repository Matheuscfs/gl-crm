-- Perfil "adulto": a constraint original só aceitava pediatrico/estetico,
-- rejeitando silenciosamente o cadastro de pacientes adultos (o insert falhava
-- e o paciente sumia no próximo reload).

alter table public.patients drop constraint if exists patients_perfil_check;
alter table public.patients
  add constraint patients_perfil_check check (perfil in ('pediatrico', 'estetico', 'adulto'));
