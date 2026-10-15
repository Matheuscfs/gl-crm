-- 0027 · Acesso por equipe: criar conta é livre, ver dados não.
--
-- Até a 0026 qualquer usuário autenticado lia e gravava tudo. Como o Supabase deixa qualquer
-- pessoa criar conta pela API (com a chave pública que vai no app), isso abria o prontuário para
-- quem se cadastrasse. Agora:
--   • o acesso vale só para e-mails cadastrados e ativos em `team_users` (Configurações → Usuários & acesso);
--   • quem cria conta sem estar na lista vê "acesso pendente" e nada mais;
--   • a primeira pessoa que entrar (com a lista ainda sem e-mails) vira administradora — é a Dra.;
--   • tirar alguém da equipe corta o acesso na hora.
-- Pode rodar mais de uma vez.

alter table public.team_users add column if not exists email        text;
alter table public.team_users add column if not exists ativo        boolean not null default true;
alter table public.team_users add column if not exists admin        boolean not null default false;
alter table public.team_users add column if not exists auth_user_id uuid;
create unique index if not exists team_users_email_idx on public.team_users (lower(email)) where email is not null;

-- quem está na equipe (e ativo)?
create or replace function public.is_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_users t
    where t.ativo and t.email is not null and lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_users t
    where t.ativo and t.admin and lower(t.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;

-- situação do usuário logado: 'equipe' | 'admin' | 'pendente'. Na primeira vez (nenhum e-mail na
-- lista ainda) quem chamar vira administradora — o app chama isto logo depois do login.
create or replace function public.minha_situacao() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_nome  text := coalesce(auth.jwt() -> 'user_metadata' ->> 'nome', split_part(v_email, '@', 1));
begin
  if v_email = '' then return 'pendente'; end if;
  if not exists (select 1 from public.team_users where email is not null) then
    -- reaproveita a linha da Dra. criada pela 0009, se houver; senão cria
    update public.team_users set email = v_email, admin = true, ativo = true, auth_user_id = auth.uid()
    where id = (select id from public.team_users where role ilike '%admin%' and email is null order by created_at limit 1);
    if not found then
      insert into public.team_users (name, role, initials, email, admin, ativo, auth_user_id)
      values (v_nome, 'Administradora', upper(left(v_nome, 2)), v_email, true, true, auth.uid());
    end if;
    return 'admin';
  end if;
  update public.team_users set auth_user_id = auth.uid() where lower(email) = v_email and auth_user_id is null;
  if public.is_admin() then return 'admin'; end if;
  if public.is_equipe() then return 'equipe'; end if;
  return 'pendente';
end $$;

revoke all on function public.is_equipe() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.minha_situacao() from public;
grant execute on function public.is_equipe(), public.is_admin(), public.minha_situacao() to authenticated;

-- troca o "qualquer autenticado" por "equipe" em todas as tabelas do schema public
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', t.tablename);
    execute format('drop policy if exists "auth_all" on public.%I;', t.tablename);
    execute format('drop policy if exists "equipe" on public.%I;', t.tablename);
    if t.tablename = 'audit_log' then
      execute 'drop policy if exists "audit_read" on public.audit_log;';
      execute 'create policy "equipe" on public.audit_log for select to authenticated using (public.is_equipe());';
    elsif t.tablename = 'team_users' then
      -- a equipe vê a lista; só a administradora inclui, altera ou tira gente
      execute 'drop policy if exists "equipe_admin" on public.team_users;';
      execute 'create policy "equipe" on public.team_users for select to authenticated using (public.is_equipe());';
      execute 'create policy "equipe_admin" on public.team_users for all to authenticated using (public.is_admin()) with check (public.is_admin());';
    else
      execute format('create policy "equipe" on public.%I for all to authenticated using (public.is_equipe()) with check (public.is_equipe());', t.tablename);
    end if;
  end loop;
end $$;

-- fotos e anexos do prontuário: também só a equipe
do $$
begin
  drop policy if exists "pp_read" on storage.objects;
  drop policy if exists "pp_write" on storage.objects;
  drop policy if exists "pp_update" on storage.objects;
  drop policy if exists "pp_delete" on storage.objects;
  drop policy if exists "pf_read" on storage.objects;
  drop policy if exists "pf_write" on storage.objects;
  drop policy if exists "pf_update" on storage.objects;
  drop policy if exists "pf_delete" on storage.objects;
  create policy "pp_read"   on storage.objects for select to authenticated using (bucket_id in ('patient-photos', 'patient-files') and public.is_equipe());
  create policy "pp_write"  on storage.objects for insert to authenticated with check (bucket_id in ('patient-photos', 'patient-files') and public.is_equipe());
  create policy "pp_update" on storage.objects for update to authenticated using (bucket_id in ('patient-photos', 'patient-files') and public.is_equipe());
  create policy "pp_delete" on storage.objects for delete to authenticated using (bucket_id in ('patient-photos', 'patient-files') and public.is_equipe());
end $$;
