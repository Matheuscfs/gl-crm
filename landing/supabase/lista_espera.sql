-- Lista de espera da landing (landing/). Rode uma vez no SQL Editor do projeto Supabase da
-- landing e coloque a URL e a chave publicável dele em PUBLIC_SUPABASE_URL/PUBLIC_SUPABASE_KEY.
-- O visitante (anon) só consegue INSERIR; ler, exportar e apagar é pelo painel do Supabase.

create table if not exists public.lista_espera (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  nome text not null check (char_length(nome) between 2 and 120),
  email text not null check (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  whatsapp text check (char_length(whatsapp) <= 30),
  tamanho text not null default 'solo' check (tamanho in ('solo', '2-4', '5+')),
  origem text check (char_length(origem) <= 120)
);

-- o mesmo e-mail não entra duas vezes (a página mostra "você já estava na lista")
create unique index if not exists lista_espera_email_key on public.lista_espera (lower(email));

alter table public.lista_espera enable row level security;
revoke all on public.lista_espera from anon, authenticated;
grant insert (nome, email, whatsapp, tamanho, origem) on public.lista_espera to anon;

drop policy if exists "visitante entra na lista" on public.lista_espera;
create policy "visitante entra na lista" on public.lista_espera
  for insert to anon with check (true);
