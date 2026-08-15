-- CPF do responsável na aba Dados.
alter table public.responsaveis
  add column if not exists cpf text;
