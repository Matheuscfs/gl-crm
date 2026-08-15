-- Seed opcional — espelha os dados mockados de src/data.ts.
-- Rode apenas se quiser começar com dados de exemplo.

insert into public.patients (name, age, resp, last, next, tipo, status, perfil, late, initials) values
  ('Sofia Ribeiro Martins','8a 4m','Ana Paula · mãe','12/03/2026','12/09/2026','Particular','tratamento','pediatrico',false,'SM'),
  ('Miguel Andrade','6a 1m','Carla Andrade · mãe','17/07/2026','17/01/2027','Convênio','manutencao','pediatrico',false,'MA'),
  ('Bento Correia','3a 2m','Rafael Correia · pai','17/07/2026','14/08/2026','Particular','primeira','pediatrico',false,'BC'),
  ('Laura Nunes','4a 0m','Bianca Nunes · mãe','—','a agendar','Particular','lead','pediatrico',false,'LN'),
  ('Alice Ferreira','5a 6m','Juliana Ferreira · mãe','14/01/2026','14/07/2026','Convênio','tratamento','pediatrico',false,'AF'),
  ('Camila Nogueira','32a','—','02/07/2026','02/11/2026','Particular','manutencao','estetico',false,'CM'),
  ('Rodrigo Alves','41a','—','28/06/2026','a agendar','Particular','concluido','estetico',false,'RA'),
  ('Davi Moreira','5a 9m','Sandra Moreira · mãe','20/12/2025','vencido há 22d','Particular','tratamento','pediatrico',true,'DM'),
  ('Isabela Pires','10a 2m','Marcos Pires · pai','10/07/2026','10/10/2026','Convênio','concluido','pediatrico',false,'IP');

insert into public.procedures (proc, cat, dur, val) values
  ('1ª consulta / avaliação','Diagnóstico','40 min','R$ 150,00'),
  ('Profilaxia + flúor','Prevenção','30 min','R$ 120,00'),
  ('Selante (por dente)','Prevenção','20 min','R$ 90,00'),
  ('Restauração em resina','Dentística','40 min','R$ 180,00'),
  ('Pulpotomia','Endodontia','50 min','R$ 320,00'),
  ('Extração de decíduo','Cirurgia','30 min','R$ 160,00');

insert into public.stock_items (item, cat, qtd, min, un, status, ent) values
  ('Anestésico lidocaína 2%','Anestésicos',42,30,'tubetes','ok','12/07'),
  ('Resina composta A2','Restauradores',6,8,'seringas','baixo','28/06'),
  ('Flúor gel acidulado','Prevenção',3,4,'frascos','baixo','02/07'),
  ('Selante fotopolimerizável','Prevenção',11,6,'seringas','ok','02/07'),
  ('Luvas de procedimento M','Descartáveis',2,5,'caixas','critico','20/06'),
  ('Ácido fosfórico 37%','Restauradores',5,4,'seringas','ok','28/06'),
  ('Sugador descartável','Descartáveis',14,10,'pacotes','ok','12/07'),
  ('Broca esférica carbide','Instrumental',3,6,'unid','baixo','15/05');

insert into public.leads (name, resp, info, stage) values
  ('Laura Nunes','Bianca · mãe','Instagram · há 2d',0),
  ('Enzo Lima','Paula · mãe','Indicação · há 1d',0),
  ('Cecília Alves','Rita · mãe','19/07 · 09:00',1),
  ('Bento Correia','Rafael · pai','hoje',2),
  ('Alice Ferreira','Juliana · mãe','Plano #218',3),
  ('Sofia Martins','Ana Paula · mãe','2/3 sessões',4),
  ('Isabela Pires','Marcos · pai','10/07',5),
  ('Théo Ramos','Diego · pai','retorno em 6m',6);

insert into public.message_templates (title, body) values
  ('Lembrete 48h antes','Oi, {responsavel}! Lembrando a consulta da {crianca} em {data}. Confirma?'),
  ('Aniversário','Feliz aniversário, {crianca}! 🎉 A equipe Sorriso Miúdo deseja tudo de bom!'),
  ('Retorno de 6 meses','Está na hora do retorno da {crianca}. Quer agendar?');

insert into public.appointments (child, age, proc, status, day, "start", dur) values
  ('Helena S.','6a','Restauração','confirmado',0,8,1),
  ('Théo R.','7a','Selante','agendado',0,9.5,1),
  ('Cauã L.','9a','Extração','desmarcado',0,14,1.5),
  ('Laura N.','4a','1ª consulta','confirmado',1,10,1),
  ('Pedro M.','6a','Profilaxia','agendado',1,15,1),
  ('Miguel A.','6a','Profilaxia','concluido',2,8,1),
  ('Sofia M.','8a','Manut. aparelho','em_atendimento',2,9,1.5),
  ('Bento C.','3a','Restauração','agendado',2,11,1),
  ('Alice F.','5a','Retorno 6m','confirmado',2,14,1),
  ('Nina B.','7a','Flúor','agendado',2,16,1),
  ('Davi M.','5a','Restauração','faltou',3,9,1),
  ('Isabela P.','10a','Aparelho','confirmado',3,13,1.5),
  ('Lorenzo A.','4a','1ª consulta','confirmado',4,8.5,1),
  ('Manuela D.','6a','Profilaxia','agendado',4,15,1),
  ('Gael P.','3a','Retorno','confirmado',5,9,1);
