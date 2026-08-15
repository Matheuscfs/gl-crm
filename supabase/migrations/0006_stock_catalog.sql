-- Catálogo de materiais (odontológico + harmonização orofacial).
-- Alimenta o banco para o cadastro de estoque puxar categoria/unidade/mínimo.

create table if not exists public.stock_catalog (
  id      uuid primary key default gen_random_uuid(),
  item    text unique not null,
  cat     text,
  un      text,
  min     int default 0
);

alter table public.stock_catalog enable row level security;
drop policy if exists "catalog_read" on public.stock_catalog;
create policy "catalog_read" on public.stock_catalog for select to anon, authenticated using (true);
drop policy if exists "catalog_write" on public.stock_catalog;
create policy "catalog_write" on public.stock_catalog for all to anon, authenticated using (true) with check (true);

insert into public.stock_catalog (item, cat, un, min) values
  ('Luvas de procedimento P','Descartáveis','caixas',5),
  ('Luvas de procedimento M','Descartáveis','caixas',5),
  ('Luvas de procedimento G','Descartáveis','caixas',5),
  ('Máscara cirúrgica tripla','Biossegurança','caixas',4),
  ('Touca descartável','Biossegurança','pacotes',3),
  ('Avental/campo descartável','Biossegurança','pacotes',3),
  ('Óculos de proteção','Biossegurança','unid',2),
  ('Sugador descartável','Descartáveis','pacotes',10),
  ('Babador odontológico','Descartáveis','pacotes',4),
  ('Rolo de algodão','Descartáveis','pacotes',6),
  ('Gaze estéril','Descartáveis','pacotes',8),
  ('Microbrush (ponta aplicadora)','Descartáveis','caixas',4),
  ('Copo descartável','Descartáveis','pacotes',5),
  ('Filme PVC protetor','Biossegurança','rolos',3),
  ('Envelope para autoclave','Biossegurança','caixas',3),
  ('Anestésico lidocaína 2%','Anestésicos','tubetes',30),
  ('Anestésico mepivacaína 3%','Anestésicos','tubetes',20),
  ('Anestésico articaína 4%','Anestésicos','tubetes',20),
  ('Anestésico tópico (benzocaína)','Anestésicos','potes',2),
  ('Agulha gengival curta','Anestésicos','caixas',3),
  ('Agulha gengival longa','Anestésicos','caixas',3),
  ('Resina composta A1','Restauradores','seringas',6),
  ('Resina composta A2','Restauradores','seringas',8),
  ('Resina composta A3','Restauradores','seringas',6),
  ('Ácido fosfórico 37%','Restauradores','seringas',4),
  ('Sistema adesivo','Restauradores','frascos',3),
  ('Ionômero de vidro','Restauradores','kits',2),
  ('Tira de poliéster','Restauradores','pacotes',3),
  ('Matriz metálica','Restauradores','caixas',2),
  ('Flúor gel acidulado','Prevenção','frascos',4),
  ('Verniz de flúor','Prevenção','bisnagas',3),
  ('Selante fotopolimerizável','Prevenção','seringas',6),
  ('Pasta profilática','Prevenção','potes',3),
  ('Escova de Robinson','Prevenção','pacotes',4),
  ('Hipoclorito de sódio 2,5%','Endodontia','frascos',3),
  ('Lima endodôntica','Endodontia','caixas',3),
  ('Cone de papel absorvente','Endodontia','caixas',3),
  ('Cone de guta-percha','Endodontia','caixas',3),
  ('Cimento endodôntico','Endodontia','kits',2),
  ('EDTA','Endodontia','frascos',2),
  ('Fio de sutura','Cirurgia','caixas',3),
  ('Lâmina de bisturi','Cirurgia','caixas',2),
  ('Clorexidina 0,12%','Cirurgia','frascos',3),
  ('Clorexidina 2%','Cirurgia','frascos',2),
  ('Broca esférica carbide','Instrumental','unid',6),
  ('Broca diamantada','Instrumental','unid',6),
  ('Ponta de ultrassom','Instrumental','unid',3),
  ('Álcool 70%','Assepsia','litros',3),
  ('Detergente enzimático','Assepsia','frascos',2),
  ('Bicarbonato de sódio (jato)','Assepsia','pacotes',3),
  ('Toxina botulínica','Harmonização','frascos',4),
  ('Ácido hialurônico (preenchedor)','Harmonização','seringas',4),
  ('Bioestimulador de colágeno','Harmonização','frascos',2),
  ('Microcânula','Harmonização','unid',10),
  ('Agulha ultrafina 30G','Harmonização','caixas',3),
  ('Seringa 1ml luer lock','Harmonização','unid',20),
  ('Solução fisiológica 0,9%','Harmonização','frascos',5),
  ('Gel pós-procedimento','Harmonização','bisnagas',3)
on conflict (item) do nothing;
