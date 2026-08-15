-- Adiciona os pacientes estéticos (adultos) ao banco que já foi populado.
-- Rode isto se você já tinha rodado o 0002_seed.sql (que não os incluía).

-- garante a coluna perfil (caso ainda não exista)
alter table public.patients add column if not exists perfil text default 'pediatrico';

insert into public.patients (name, age, resp, last, next, tipo, status, perfil, late, initials, sex)
select 'Camila Nogueira','32a','—','02/07/2026','02/11/2026','Particular','manutencao','estetico',false,'CM','Feminino'
where not exists (select 1 from public.patients where name = 'Camila Nogueira');

insert into public.patients (name, age, resp, last, next, tipo, status, perfil, late, initials, sex)
select 'Rodrigo Alves','41a','—','28/06/2026','a agendar','Particular','concluido','estetico',false,'RA','Masculino'
where not exists (select 1 from public.patients where name = 'Rodrigo Alves');
