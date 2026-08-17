-- Recibos emitidos (quando o paciente/responsável pede recibo).
-- Guarda o que o Carnê-Leão exige: data, CPF e nome do pagador, descrição e valor.
-- A numeração é sequencial e única por consultório.

alter table public.clinic_settings add column if not exists cpf text;

create sequence if not exists public.receipt_number_seq;

create table if not exists public.receipts (
  id          uuid primary key default gen_random_uuid(),
  number      int not null default nextval('public.receipt_number_seq'),
  patient_id  uuid references public.patients(id) on delete set null,
  payer_name  text not null,
  payer_cpf   text,
  description text,
  value       numeric(12,2) not null default 0,
  issued_on   date not null default current_date,
  -- de onde saiu: parcela (contas a receber), lancamento (receita) ou avulso
  origin      text not null default 'avulso',
  ref_id      text,
  created_at  timestamptz default now()
);

create index if not exists receipts_issued_on_idx on public.receipts (issued_on desc);
create index if not exists receipts_patient_idx on public.receipts (patient_id);

alter table public.receipts enable row level security;
drop policy if exists "prototype_all" on public.receipts;
create policy "prototype_all" on public.receipts for all to anon, authenticated using (true) with check (true);

-- pacientes que sempre pedem recibo (marca no cadastro, para lembrar no recebimento)
alter table public.patients add column if not exists quer_recibo boolean default false;
