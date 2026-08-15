-- Unifica ficha técnica com a tabela de procedimentos:
-- cada procedimento passa a guardar os materiais consumidos (baixa automática no estoque).

alter table public.procedures add column if not exists lines jsonb not null default '[]';
