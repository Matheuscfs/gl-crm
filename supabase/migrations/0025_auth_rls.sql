-- Fecha o banco: só usuário autenticado lê ou grava.
--
-- Até aqui as policies do protótipo liberavam tudo para o papel `anon` — como a URL
-- e a chave publishable vão no bundle do app, qualquer pessoa com o link conseguia
-- ler e gravar prontuário, CPF e telefone direto na API REST.
--
-- Depois de aplicar esta migração o app EXIGE login (tela de entrada do CRM).
-- Crie os usuários da equipe em Authentication → Users → Add user, no painel do Supabase.
--
-- ATENÇÃO: o bloco abaixo remove TODAS as policies do schema public e recria uma
-- única policy `auth_all` por tabela. Se você tiver criado policies próprias à mão,
-- revise antes de rodar.

do $$
declare
  p record;
  t record;
begin
  -- 1) limpa as policies do protótipo (prototype_all, catalog_read, catalog_write, …)
  for p in
    select policyname, tablename from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I;', p.policyname, p.tablename);
  end loop;

  -- 2) RLS ligada em tudo + acesso apenas para autenticados
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', t.tablename);
    execute format(
      'create policy "auth_all" on public.%I for all to authenticated using (true) with check (true);',
      t.tablename
    );
  end loop;
end $$;

-- ---------- Storage (fotos dos pacientes) ----------
-- Gravar, alterar e apagar objetos passa a exigir login. A leitura continua pública
-- porque o bucket `patient-photos` é público e as URLs já gravadas em
-- patients.photo_url / patient_photos.url dependem disso — para fechar de vez é
-- preciso tornar o bucket privado e migrar o app para URLs assinadas.
do $$
begin
  drop policy if exists "pp_read" on storage.objects;
  drop policy if exists "pp_write" on storage.objects;
  drop policy if exists "pp_update" on storage.objects;
  drop policy if exists "pp_delete" on storage.objects;

  create policy "pp_read" on storage.objects
    for select to anon, authenticated using (bucket_id = 'patient-photos');
  create policy "pp_write" on storage.objects
    for insert to authenticated with check (bucket_id = 'patient-photos');
  create policy "pp_update" on storage.objects
    for update to authenticated using (bucket_id = 'patient-photos');
  create policy "pp_delete" on storage.objects
    for delete to authenticated using (bucket_id = 'patient-photos');
end $$;
