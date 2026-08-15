-- Lançamentos financeiros manuais (receitas e despesas).
create table if not exists public.finance_entries (
  id          uuid primary key default gen_random_uuid(),
  entry_date  text,
  type        text default 'receita' check (type in ('receita', 'despesa')),
  description text,
  category    text,
  value       numeric default 0,
  status      text default 'pago' check (status in ('pago', 'aberto')),
  created_at  timestamptz default now()
);

alter table public.finance_entries enable row level security;
drop policy if exists "prototype_all" on public.finance_entries;
create policy "prototype_all" on public.finance_entries for all to anon, authenticated using (true) with check (true);
