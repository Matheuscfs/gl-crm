-- Inventário real do consultório (contagem de 17/08/2026) organizado por área,
-- com estoque mínimo SUGERIDO (min_auto = true) para a Dra. confirmar no app.
--
-- 1) coluna min_auto  2) limpeza do estoque/catálogo de demonstração
-- 3) itens da contagem  4) catálogo (itens + materiais só de compra).

alter table public.stock_items add column if not exists min_auto boolean default false;

-- ---------- 1. Estoque de demonstração do protótipo (0002_seed.sql) ----------
-- Só apaga linhas ainda idênticas ao seed (item + cat + un + qtd + min):
-- se a clínica editou alguma, ela é preservada.
delete from public.stock_items s
using (values
  ('Anestésico lidocaína 2%','Anestésicos',42,30,'tubetes'),
  ('Resina composta A2','Restauradores',6,8,'seringas'),
  ('Flúor gel acidulado','Prevenção',3,4,'frascos'),
  ('Selante fotopolimerizável','Prevenção',11,6,'seringas'),
  ('Luvas de procedimento M','Descartáveis',2,5,'caixas'),
  ('Ácido fosfórico 37%','Restauradores',5,4,'seringas'),
  ('Sugador descartável','Descartáveis',14,10,'pacotes'),
  ('Broca esférica carbide','Instrumental',3,6,'unid')
) as demo(item, cat, qtd, min, un)
where s.item = demo.item and s.cat = demo.cat and s.un = demo.un
  and s.qtd = demo.qtd and s.min = demo.min;

-- nomes genéricos do catálogo antigo (0006) substituídos pelos nomes reais da clínica
delete from public.stock_catalog where item in (
  'Luvas de procedimento P','Luvas de procedimento M','Luvas de procedimento G',
  'Máscara cirúrgica tripla','Touca descartável','Avental/campo descartável',
  'Sugador descartável','Babador odontológico','Rolo de algodão','Gaze estéril',
  'Microbrush (ponta aplicadora)','Anestésico lidocaína 2%','Anestésico mepivacaína 3%',
  'Anestésico articaína 4%','Anestésico tópico (benzocaína)','Agulha gengival curta',
  'Agulha gengival longa','Resina composta A1','Resina composta A2','Resina composta A3',
  'Ácido fosfórico 37%','Sistema adesivo','Ionômero de vidro','Matriz metálica',
  'Selante fotopolimerizável','Escova de Robinson','Lima endodôntica',
  'Cone de papel absorvente','Cone de guta-percha'
);

-- ---------- 2. Itens da contagem ----------
-- Só insere o que ainda não existe: nunca sobrescreve uma contagem em uso.
insert into public.stock_items (item, cat, un, qtd, min, min_auto, status, ent)
select v.item, v.cat, v.un, v.qtd, v.min, true,
  case
    when v.qtd <= 0 or v.qtd * 2 < v.min then 'critico'
    when v.qtd < v.min then 'baixo'
    else 'ok'
  end,
  '17/08'
from (values
  -- Biossegurança e materiais gerais
  ('Paramentação cirúrgica','Biossegurança','kit',5,3),
  ('Luva estéril','Biossegurança','un',4,4),
  ('Luva','Biossegurança','caixa',1,2),
  ('Luva polietileno','Biossegurança','pacote',1,1),
  ('Máscara','Biossegurança','caixa',1,2),
  ('Gorro','Biossegurança','pacote',2,1),
  ('Gaze','Biossegurança','pacote',1,2),
  ('Algodão','Biossegurança','pacote',5,3),
  ('Babador','Biossegurança','pacote',2,2),
  ('Sugador','Biossegurança','pacote',1,2),
  ('Cuba cirúrgica','Biossegurança','un',3,2),
  ('Vaselina','Biossegurança','un',1,1),
  -- Anestesia
  ('Seringa 5 ml','Anestesia','un',12,6),
  ('Seringa 20 ml','Anestesia','un',5,3),
  ('Agulha curta','Anestesia','caixa',1,1),
  ('Agulha longa','Anestesia','caixa',1,1),
  ('Lidocaína','Anestesia','un',12,10),
  ('Mepivacaína','Anestesia','un',30,20),
  ('Anestésico tópico','Anestesia','un',1,1),
  -- Profilaxia e prevenção
  ('Pasta profilática','Profilaxia','un',2,2),
  ('Taça Dino','Profilaxia','un',30,15),
  ('Taça de borracha','Profilaxia','un',10,6),
  ('Escova Robinson','Profilaxia','un',5,4),
  ('Fio dental','Profilaxia','un',1,1),
  ('Evidenciador de placa','Profilaxia','un',1,1),
  ('Pasta c/ flúor infantil','Profilaxia','un',1,1),
  ('Escova clorexidina','Profilaxia','un',5,3),
  -- Odontopediatria
  ('Selante','Odontopediatria','un',4,3),
  ('Coroa de acetato','Odontopediatria','jogo',1,1),
  ('Abridor de lábios inferior','Odontopediatria','un',2,1),
  ('Afastador de lábios inferior','Odontopediatria','un',3,2),
  ('Abridor de silicone','Odontopediatria','un',2,2),
  ('Abridor Molt','Odontopediatria','un',1,1),
  ('Banda 0,5','Odontopediatria','un',4,2),
  ('Banda 0,7','Odontopediatria','un',2,2),
  ('Colgadura','Odontopediatria','un',7,4),
  -- Dentística / Restauradora
  ('Ácido','Dentística','un',4,3),
  ('Adesivo','Dentística','un',1,2),
  ('Silano','Dentística','un',2,1),
  ('Resina','Dentística','un',12,8),
  ('Microbrush','Dentística','kit',2,2),
  ('Restaurador provisório','Dentística','un',1,1),
  ('RIVA foto','Dentística','un',1,1),
  ('RIVA químico','Dentística','un',1,1),
  ('CIV convencional','Dentística','un',1,1),
  ('Dycal','Dentística','kit',1,1),
  ('Tira dentada','Dentística','un',1,1),
  ('Tira de poliéster','Dentística','caixa',1,1),
  ('Tira de lixa','Dentística','caixa',1,1),
  ('Tira de lixa em aço','Dentística','caixa',1,1),
  ('Disco de lixa','Dentística','jogo',2,2),
  ('Borracha de polimento','Dentística','kit',2,1),
  ('Cunha de madeira','Dentística','jogo',1,1),
  ('Porta matriz','Dentística','un',2,1),
  ('Matriz de Tofflemire','Dentística','pacote',2,1),
  ('Unimatrix','Dentística','kit',1,1),
  ('Pasta de polimento','Dentística','un',1,1),
  -- Endodontia
  ('Kit endo','Endodontia','kit',2,1),
  ('Cone R7','Endodontia','caixa',1,1),
  ('Cone R8','Endodontia','caixa',1,1),
  ('Papel absorvente 15–40','Endodontia','jogo',1,1),
  ('Papel absorvente 45–80','Endodontia','jogo',1,1),
  ('Cone de guta 15–40','Endodontia','caixa',1,1),
  ('Cone de guta 45–80','Endodontia','caixa',1,1),
  ('Cone de guta F','Endodontia','caixa',1,1),
  ('Lima 21 mm','Endodontia','jogo',1,2),
  ('Lima 25 mm','Endodontia','jogo',2,2),
  ('Lima 31 mm','Endodontia','jogo',1,1),
  ('Condensador McSpadden','Endodontia','un',3,2),
  ('Espaçador digital','Endodontia','un',4,2),
  ('Broca Gates','Endodontia','kit',2,1),
  ('Broca Largo','Endodontia','kit',1,1),
  -- Isolamento absoluto
  ('Lençol de borracha','Isolamento','caixa',2,2),
  ('Arco Young','Isolamento','un',1,1),
  ('Arco Young inferior','Isolamento','un',1,1),
  ('Arco de isolamento','Isolamento','un',1,1),
  ('Arco de isolamento inferior','Isolamento','un',1,1),
  ('Bloqueador de oxigênio','Isolamento','un',3,2),
  ('Pinça perfuradora','Isolamento','un',2,1),
  ('Pinça porta-grampo','Isolamento','un',2,1),
  -- Radiologia
  ('Película periapical','Radiologia','un',50,30),
  ('Película oclusal','Radiologia','un',3,3),
  ('Posicionador radiográfico','Radiologia','kit',2,1),
  -- Clareamento
  ('Clareador consultório','Clareamento','kit',3,2),
  ('Clareador caseiro','Clareamento','un',8,4),
  ('Abridor de clareamento','Clareamento','un',1,1),
  ('Barreira gengival','Clareamento','un',2,2),
  -- Prótese / Laboratório
  ('Cera 7','Laboratório','un',1,1),
  ('Cera utilidade','Laboratório','un',1,1),
  ('Acrílico 62','Laboratório','un',1,1),
  ('Acrílico rosa','Laboratório','un',1,1),
  ('Placa de vidro','Laboratório','un',2,1),
  ('Pote Dappen','Laboratório','un',6,3),
  ('Moldeiras','Laboratório','jogo',2,1)
) as v(item, cat, un, qtd, min)
where not exists (select 1 from public.stock_items s where lower(s.item) = lower(v.item));

-- ---------- 3. Catálogo (autocomplete da entrada de estoque) ----------
-- Todo item da contagem vira entrada de catálogo, com a unidade/mínimo atuais.
insert into public.stock_catalog (item, cat, un, min)
select s.item, s.cat, s.un, s.min
from public.stock_items s
where s.cat in ('Biossegurança','Anestesia','Profilaxia','Odontopediatria','Dentística',
                'Endodontia','Isolamento','Radiologia','Clareamento','Laboratório')
on conflict (item) do update set cat = excluded.cat, un = excluded.un, min = excluded.min;

-- materiais que a clínica compra mas ainda não entram na contagem física
insert into public.stock_catalog (item, cat, un, min) values
  ('Óculos de proteção','Biossegurança','un',2),
  ('Filme PVC protetor','Biossegurança','rolo',3),
  ('Envelope para autoclave','Biossegurança','caixa',3),
  ('Copo descartável','Biossegurança','pacote',5),
  ('Articaína 4%','Anestesia','un',10),
  ('Flúor gel acidulado','Profilaxia','un',2),
  ('Verniz de flúor','Profilaxia','un',2),
  ('Hipoclorito de sódio 2,5%','Endodontia','un',2),
  ('EDTA','Endodontia','un',2),
  ('Cimento endodôntico','Endodontia','kit',1),
  ('Fio de sutura','Cirurgia','caixa',2),
  ('Lâmina de bisturi','Cirurgia','caixa',1),
  ('Clorexidina 0,12%','Cirurgia','un',2),
  ('Clorexidina 2%','Cirurgia','un',1),
  ('Broca esférica carbide','Instrumental','un',6),
  ('Broca diamantada','Instrumental','un',6),
  ('Ponta de ultrassom','Instrumental','un',3),
  ('Álcool 70%','Assepsia','litro',3),
  ('Detergente enzimático','Assepsia','un',2),
  ('Bicarbonato de sódio (jato)','Assepsia','pacote',3),
  ('Toxina botulínica','Harmonização','frasco',4),
  ('Ácido hialurônico (preenchedor)','Harmonização','seringa',4),
  ('Bioestimulador de colágeno','Harmonização','frasco',2),
  ('Microcânula','Harmonização','un',10),
  ('Agulha ultrafina 30G','Harmonização','caixa',3),
  ('Seringa 1ml luer lock','Harmonização','un',20),
  ('Solução fisiológica 0,9%','Harmonização','frasco',5),
  ('Gel pós-procedimento','Harmonização','un',3)
on conflict (item) do update set cat = excluded.cat, un = excluded.un, min = excluded.min;
