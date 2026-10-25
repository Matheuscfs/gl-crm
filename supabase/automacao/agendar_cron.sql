-- Agenda a automação (confirmações, cobranças, lembretes) para rodar a cada 15 minutos.
-- Rode UMA vez no SQL Editor, DEPOIS de publicar a função `automacao` (veja supabase/functions/README.md).
--
-- Troque os dois valores entre <...>:
--   <PROJECT_REF>  → o id do projeto (aparece na URL: https://<PROJECT_REF>.supabase.co)
--   <CRON_SECRET>  → o mesmo segredo cadastrado em Edge Functions → Secrets → CRON_SECRET

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- os valores ficam no cofre do Supabase (não aparecem no código do agendamento)
select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'gl_project_url')
where not exists (select 1 from vault.secrets where name = 'gl_project_url');
select vault.create_secret('<CRON_SECRET>', 'gl_cron_secret')
where not exists (select 1 from vault.secrets where name = 'gl_cron_secret');

select cron.unschedule('gl-automacao') where exists (select 1 from cron.job where jobname = 'gl-automacao');
select cron.schedule(
  'gl-automacao',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'gl_project_url') || '/functions/v1/automacao',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'gl_cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Conferir:   select * from cron.job_run_details order by start_time desc limit 10;
-- Pausar:     select cron.unschedule('gl-automacao');
