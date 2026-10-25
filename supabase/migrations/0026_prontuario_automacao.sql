-- 0026 · Prontuário com rastro, odontograma por face, harmonização com lote, índices
-- pediátricos, anexos de verdade, automação (WhatsApp/cobrança) e agendamento online.
--
-- Pode rodar mais de uma vez (tudo é "if not exists" / "or replace").
-- Depois de rodar, o app passa a usar as colunas novas sozinho (ele testa se existem).

-- =====================================================================================
-- 1. Agenda: agendamento ligado ao paciente e ao procedimento; cobrança uma vez só
-- =====================================================================================
alter table public.appointments add column if not exists patient_id      uuid references public.patients(id) on delete set null;
alter table public.appointments add column if not exists procedimento_id uuid references public.procedures(id) on delete set null;
alter table public.appointments add column if not exists cobrado_em      timestamptz;
alter table public.appointments add column if not exists gcal_id         text;
alter table public.appointments add column if not exists confirmado_em   timestamptz;
alter table public.appointments add column if not exists lembrete_em     timestamptz;
create index if not exists appointments_date_idx on public.appointments (date);
create index if not exists appointments_patient_idx on public.appointments (patient_id);

-- liga os agendamentos antigos ao cadastro quando o nome é exatamente igual (sem ambiguidade)
update public.appointments a set patient_id = p.id
from public.patients p
where a.patient_id is null and lower(trim(a.child)) = lower(trim(p.name))
  and (select count(*) from public.patients p2 where lower(trim(p2.name)) = lower(trim(p.name))) = 1;

-- =====================================================================================
-- 2. Estoque: movimentações gravadas (antes ficavam só na memória do navegador)
-- =====================================================================================
create table if not exists public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,
  descricao   text,
  delta       text,
  kind        text not null check (kind in ('entrada', 'saida')),
  item_id     uuid references public.stock_items(id) on delete set null,
  created_by  uuid default auth.uid(),
  created_at  timestamptz default now()
);
create index if not exists stock_movements_created_idx on public.stock_movements (created_at desc);

-- =====================================================================================
-- 3. Financeiro: data de pagamento (faturamento e recibo na data certa) e cobrança via PSP
-- =====================================================================================
alter table public.installments add column if not exists pago_em         date;
alter table public.installments add column if not exists cobranca_id     text;   -- id da cobrança no PSP (Asaas, Efí…)
alter table public.installments add column if not exists cobranca_link   text;   -- link de pagamento / PIX
alter table public.installments add column if not exists cobranca_status text;
alter table public.installments add column if not exists lembrete_em     timestamptz;
-- Receita Saúde: marca quando o recibo foi lançado no app da Receita
alter table public.receipts add column if not exists receita_saude_em timestamptz;

-- =====================================================================================
-- 4. Clínica: cidade separada (o PIX usava o endereço cortado como cidade) e quem assina
-- =====================================================================================
alter table public.clinic_settings add column if not exists cidade        text;
alter table public.clinic_settings add column if not exists uf            text;
alter table public.clinic_settings add column if not exists profissional  text;  -- nome na assinatura dos documentos
alter table public.clinic_settings add column if not exists especialidade text;  -- linha abaixo do nome

-- =====================================================================================
-- 5. Odontograma por face (M, D, O/I, V, L/P) e observação por dente
-- =====================================================================================
alter table public.teeth add column if not exists faces jsonb default '{}'::jsonb;
alter table public.teeth add column if not exists obs   text;
alter table public.teeth add column if not exists updated_at timestamptz default now();

-- =====================================================================================
-- 6. Documentos: anexo de verdade (Storage) e documentos emitidos (receita, atestado…)
-- =====================================================================================
alter table public.documents add column if not exists storage_path text;   -- caminho no bucket patient-files
alter table public.documents add column if not exists mime         text;
alter table public.documents add column if not exists size_bytes   bigint;
alter table public.documents add column if not exists tipo_doc     text;   -- anexo | radiografia | foto | receituario | atestado | declaracao
alter table public.documents add column if not exists payload      jsonb;  -- conteúdo emitido, para reimprimir igual
alter table public.documents add column if not exists dente        text;   -- radiografia/foto ligada a um dente (FDI)
alter table public.documents add column if not exists session_id   uuid references public.photo_sessions(id) on delete set null;

insert into storage.buckets (id, name, public)
values ('patient-files', 'patient-files', false)
on conflict (id) do update set public = false;

do $$
begin
  drop policy if exists "pf_read" on storage.objects;
  drop policy if exists "pf_write" on storage.objects;
  drop policy if exists "pf_update" on storage.objects;
  drop policy if exists "pf_delete" on storage.objects;
  create policy "pf_read"   on storage.objects for select to authenticated using (bucket_id = 'patient-files');
  create policy "pf_write"  on storage.objects for insert to authenticated with check (bucket_id = 'patient-files');
  create policy "pf_update" on storage.objects for update to authenticated using (bucket_id = 'patient-files');
  create policy "pf_delete" on storage.objects for delete to authenticated using (bucket_id = 'patient-files');
end $$;

-- =====================================================================================
-- 7. Harmonização: cada aplicação com produto, lote e validade (rastreabilidade)
-- =====================================================================================
create table if not exists public.aplicacoes (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid references public.patients(id) on delete cascade,
  aplicado_em  date not null default current_date,
  produto      text not null,               -- ex.: toxina botulínica (marca), ácido hialurônico
  lote         text not null,
  validade     date,
  zonas        jsonb not null default '{}'::jsonb,  -- {"testa": 10, "glabela": 12}
  unidades     numeric(8,2) not null default 0,
  observacoes  text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz default now()
);
create index if not exists aplicacoes_patient_idx on public.aplicacoes (patient_id, aplicado_em desc);

-- =====================================================================================
-- 8. Odontopediatria: risco de cárie, índice de placa, flúor e selantes com reavaliação
-- =====================================================================================
create table if not exists public.indices_clinicos (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid references public.patients(id) on delete cascade,
  avaliado_em   date not null default current_date,
  risco_carie   text check (risco_carie in ('baixo', 'moderado', 'alto')),
  indice_placa  numeric(5,2),               -- % de faces com placa (O'Leary)
  fluor         boolean default false,
  selantes      text[] default '{}',        -- dentes selados nesta sessão (FDI)
  reavaliar_em  date,                       -- alimenta o lembrete de retorno
  observacoes   text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz default now()
);
create index if not exists indices_patient_idx on public.indices_clinicos (patient_id, avaliado_em desc);

-- =====================================================================================
-- 9. Prontuário com rastro: evolução e atendimento não se apagam (anula-se com motivo),
--    e toda alteração clínica fica registrada (quem, quando, antes e depois).
-- =====================================================================================
alter table public.evolucoes  add column if not exists anulada_em     timestamptz;
alter table public.evolucoes  add column if not exists anulada_motivo text;
alter table public.evolucoes  add column if not exists anulada_por    uuid;
alter table public.evolucoes  add column if not exists created_by     uuid default auth.uid();
alter table public.treatments add column if not exists anulada_em     timestamptz;
alter table public.treatments add column if not exists anulada_motivo text;
alter table public.treatments add column if not exists anulada_por    uuid;
alter table public.treatments add column if not exists created_by     uuid default auth.uid();

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  tabela      text not null,
  registro_id text,
  patient_id  uuid,
  acao        text not null,               -- INSERT | UPDATE | DELETE
  antes       jsonb,
  depois      jsonb,
  usuario     uuid default auth.uid(),
  email       text default (auth.jwt() ->> 'email'),
  criado_em   timestamptz default now()
);
create index if not exists audit_patient_idx on public.audit_log (patient_id, criado_em desc);

create or replace function public.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_patient uuid;
begin
  if tg_op = 'UPDATE' and v_old = v_new then return new; end if;
  v_patient := coalesce((v_new ->> 'patient_id')::uuid, (v_old ->> 'patient_id')::uuid,
                        case when tg_table_name = 'patients' then coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid) end);
  insert into public.audit_log (tabela, registro_id, patient_id, acao, antes, depois)
  values (tg_table_name, coalesce(v_new ->> 'id', v_old ->> 'id'), v_patient, tg_op, v_old, v_new);
  return coalesce(new, old);
end $$;

-- o registro clínico não se apaga: só anula (o paciente inteiro ainda pode ser excluído)
create or replace function public.bloquear_exclusao_prontuario() returns trigger
language plpgsql as $$
begin
  if pg_trigger_depth() > 1 then return old; end if;  -- exclusão em cascata do paciente
  raise exception 'Registro do prontuário não pode ser excluído. Use "Anular" com o motivo.'
    using errcode = 'P0001';
end $$;

do $$
declare t text;
begin
  foreach t in array array['patients','anamnese','teeth','treatments','evolucoes','plan_items','installments',
                           'documents','facial_map','aplicacoes','indices_clinicos','receipts','appointments']
  loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      execute format('drop trigger if exists auditoria on public.%I;', t);
      execute format('create trigger auditoria after insert or update or delete on public.%I
                      for each row execute function public.registrar_auditoria();', t);
    end if;
  end loop;
  foreach t in array array['evolucoes','treatments']
  loop
    execute format('drop trigger if exists sem_exclusao on public.%I;', t);
    execute format('create trigger sem_exclusao before delete on public.%I
                    for each row execute function public.bloquear_exclusao_prontuario();', t);
  end loop;
end $$;

-- =====================================================================================
-- 10. Automação: mensagens (WhatsApp) com histórico e régua configurável
-- =====================================================================================
create table if not exists public.mensagens (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null,          -- confirmacao | lembrete_retorno | cobranca | aniversario | pos_atendimento | estoque
  patient_id      uuid references public.patients(id) on delete set null,
  appointment_id  uuid references public.appointments(id) on delete set null,
  installment_id  uuid references public.installments(id) on delete set null,
  telefone        text,
  template        text,
  corpo           text,
  status          text not null default 'pendente' check (status in ('pendente', 'enviada', 'entregue', 'lida', 'respondida', 'falhou', 'cancelada')),
  wa_message_id   text,
  resposta        text,
  erro            text,
  agendada_para   timestamptz default now(),
  ref_dia         date not null default current_date,  -- dia de referência (cobrança D-3, D0, D+3…)
  enviada_em      timestamptz,
  created_at      timestamptz default now()
);
create index if not exists mensagens_status_idx on public.mensagens (status, agendada_para);
create index if not exists mensagens_wa_idx on public.mensagens (wa_message_id);
-- uma mensagem de cada tipo por agendamento/parcela (o agendador pode rodar várias vezes)
create unique index if not exists mensagens_unica_appt on public.mensagens (tipo, appointment_id) where appointment_id is not null;
create unique index if not exists mensagens_unica_parc on public.mensagens (tipo, installment_id, ref_dia) where installment_id is not null;

alter table public.regua_rules add column if not exists antecedencia_horas int;
alter table public.regua_rules add column if not exists template_meta      text;  -- nome do modelo aprovado na Meta

create table if not exists public.automacao_config (
  key                text primary key default 'automacao',
  whatsapp_ativo     boolean default false,
  confirmacao_horas  int default 24,     -- confirmação X horas antes
  cobranca_dias      int[] default '{-3,0,3}',
  retorno_meses_ped  int default 6,
  retoque_meses_est  int default 4,
  aniversario        boolean default true,
  pos_atendimento    boolean default true,
  estoque_alerta     boolean default true,
  validade_dias      int default 30,
  telefone_alertas   text,               -- WhatsApp da clínica para alertas de estoque
  updated_at         timestamptz default now()
);
insert into public.automacao_config (key) values ('automacao') on conflict (key) do nothing;

-- =====================================================================================
-- 11. Agendamento online: o público só vê horários livres e só pode PEDIR um horário
-- =====================================================================================
create table if not exists public.solicitacoes_agendamento (
  id              uuid primary key default gen_random_uuid(),
  responsavel     text not null,
  telefone        text not null,
  paciente        text not null,
  nascimento      date,
  data_desejada   date not null,
  hora_desejada   numeric(4,2) not null,
  procedimento    text,
  observacao      text,
  status          text not null default 'nova' check (status in ('nova', 'agendada', 'recusada')),
  appointment_id  uuid references public.appointments(id) on delete set null,
  created_at      timestamptz default now()
);

-- horários livres (30 em 30 min) entre duas datas, sem expor nada da agenda
create or replace function public.horarios_livres(de date, ate date)
returns table (dia date, hora numeric)
language sql stable security definer set search_path = public as $$
  with dias as (
    select d::date as dia,
           (array['DOM','SEG','TER','QUA','QUI','SEX','SÁB'])[extract(dow from d)::int + 1] as sigla
    from generate_series(greatest(de, current_date + 1), least(ate, current_date + 60), interval '1 day') d
  ),
  faixas as (
    select dias.dia, h.hours, h.closed
    from dias join public.schedule_hours h on upper(left(h.day, 3)) = dias.sigla
  ),
  janelas as (
    select dia,
           split_part(replace(hours, ' ', ''), '–', 1) as ini,
           split_part(replace(hours, ' ', ''), '–', 2) as fim
    from faixas where not coalesce(closed, false) and hours ~ '\d'
  ),
  slots as (
    select dia, gs::numeric as hora
    from janelas,
         generate_series(
           (split_part(ini, ':', 1)::numeric + coalesce(nullif(split_part(ini, ':', 2), '')::numeric, 0) / 60),
           (split_part(fim, ':', 1)::numeric + coalesce(nullif(split_part(fim, ':', 2), '')::numeric, 0) / 60) - 0.5,
           0.5) gs
  )
  select s.dia, s.hora from slots s
  where not exists (
    select 1 from public.appointments a
    where a.date = s.dia::text and a.status not in ('desmarcado', 'faltou')
      and s.hora < a.start + a.dur and a.start < s.hora + 0.5
  )
  and not exists (
    select 1 from public.solicitacoes_agendamento r
    where r.status = 'nova' and r.data_desejada = s.dia and r.hora_desejada = s.hora
  )
  order by 1, 2;
$$;

-- pedido público com validação (o anon não escreve direto na tabela)
create or replace function public.solicitar_agendamento(
  p_responsavel text, p_telefone text, p_paciente text, p_nascimento date,
  p_data date, p_hora numeric, p_procedimento text, p_observacao text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(trim(p_responsavel), '') = '' or coalesce(trim(p_paciente), '') = '' then
    raise exception 'Informe o nome do responsável e do paciente.';
  end if;
  if length(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g')) < 10 then
    raise exception 'Telefone incompleto.';
  end if;
  if not exists (select 1 from public.horarios_livres(p_data, p_data) h where h.dia = p_data and h.hora = p_hora) then
    raise exception 'Este horário não está mais livre. Escolha outro.';
  end if;
  -- limite simples contra abuso: 3 pedidos abertos por telefone
  if (select count(*) from public.solicitacoes_agendamento
      where status = 'nova' and regexp_replace(telefone, '\D', '', 'g') = regexp_replace(p_telefone, '\D', '', 'g')) >= 3 then
    raise exception 'Já existem pedidos em aberto para este telefone. A clínica vai entrar em contato.';
  end if;
  insert into public.solicitacoes_agendamento (responsavel, telefone, paciente, nascimento, data_desejada, hora_desejada, procedimento, observacao)
  values (left(trim(p_responsavel), 120), left(p_telefone, 20), left(trim(p_paciente), 120), p_nascimento, p_data, p_hora,
          left(p_procedimento, 120), left(p_observacao, 500))
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.horarios_livres(date, date) from public;
revoke all on function public.solicitar_agendamento(text, text, text, date, date, numeric, text, text) from public;
grant execute on function public.horarios_livres(date, date) to anon, authenticated;
grant execute on function public.solicitar_agendamento(text, text, text, date, date, numeric, text, text) to anon, authenticated;

-- =====================================================================================
-- 12. RLS nas tabelas novas: só autenticado (igual à 0025)
-- =====================================================================================
do $$
declare t text;
begin
  foreach t in array array['stock_movements','aplicacoes','indices_clinicos','audit_log','mensagens',
                           'automacao_config','solicitacoes_agendamento']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "auth_all" on public.%I;', t);
    execute format('create policy "auth_all" on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- o histórico de auditoria é só leitura para a equipe (quem grava é o gatilho)
drop policy if exists "auth_all" on public.audit_log;
create policy "audit_read" on public.audit_log for select to authenticated using (true);

revoke all on public.stock_movements, public.aplicacoes, public.indices_clinicos, public.audit_log,
              public.mensagens, public.automacao_config, public.solicitacoes_agendamento from anon;
grant select, insert, update, delete on public.stock_movements, public.aplicacoes, public.indices_clinicos,
              public.mensagens, public.automacao_config, public.solicitacoes_agendamento to authenticated;
grant select on public.audit_log to authenticated;

-- =====================================================================================
-- 13. Tempo real: a Agenda vê na hora a confirmação que chegou pelo WhatsApp (e o que
--     outro aparelho da clínica mudou)
-- =====================================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'appointments') then
      alter publication supabase_realtime add table public.appointments;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'mensagens') then
      alter publication supabase_realtime add table public.mensagens;
    end if;
  end if;
end $$;
