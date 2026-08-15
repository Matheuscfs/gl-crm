-- Estoque: valor unitário e marca (marca opcional) no cadastro de produto.

alter table public.stock_items add column if not exists valor text;
alter table public.stock_items add column if not exists marca text;
