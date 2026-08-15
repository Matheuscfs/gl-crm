-- Régua de comunicação: persiste o corpo da mensagem editada de cada regra.

alter table public.regua_rules add column if not exists body text;
