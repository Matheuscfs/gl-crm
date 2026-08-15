-- Estoque: validade (ISO aaaa-mm-dd), lote e fornecedor — controle de vencimento de materiais.

alter table public.stock_items add column if not exists validade text;
alter table public.stock_items add column if not exists lote text;
alter table public.stock_items add column if not exists fornecedor text;
