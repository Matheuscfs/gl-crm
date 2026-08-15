/**
 * Catálogo de materiais de consultório (odontológico + harmonização orofacial).
 * Baseado em listas de referência de estoque odontológico e insumos de HOF.
 * Usado para autocompletar categoria / unidade / mínimo ao criar uma entrada no estoque.
 */
export interface CatalogItem {
  item: string
  cat: string
  un: string
  min: number
}

export const stockCatalog: CatalogItem[] = [
  // Biossegurança / Descartáveis
  { item: 'Luvas de procedimento P', cat: 'Descartáveis', un: 'caixas', min: 5 },
  { item: 'Luvas de procedimento M', cat: 'Descartáveis', un: 'caixas', min: 5 },
  { item: 'Luvas de procedimento G', cat: 'Descartáveis', un: 'caixas', min: 5 },
  { item: 'Máscara cirúrgica tripla', cat: 'Biossegurança', un: 'caixas', min: 4 },
  { item: 'Touca descartável', cat: 'Biossegurança', un: 'pacotes', min: 3 },
  { item: 'Avental/campo descartável', cat: 'Biossegurança', un: 'pacotes', min: 3 },
  { item: 'Óculos de proteção', cat: 'Biossegurança', un: 'unid', min: 2 },
  { item: 'Sugador descartável', cat: 'Descartáveis', un: 'pacotes', min: 10 },
  { item: 'Babador odontológico', cat: 'Descartáveis', un: 'pacotes', min: 4 },
  { item: 'Rolo de algodão', cat: 'Descartáveis', un: 'pacotes', min: 6 },
  { item: 'Gaze estéril', cat: 'Descartáveis', un: 'pacotes', min: 8 },
  { item: 'Microbrush (ponta aplicadora)', cat: 'Descartáveis', un: 'caixas', min: 4 },
  { item: 'Copo descartável', cat: 'Descartáveis', un: 'pacotes', min: 5 },
  { item: 'Filme PVC protetor', cat: 'Biossegurança', un: 'rolos', min: 3 },
  { item: 'Envelope para autoclave', cat: 'Biossegurança', un: 'caixas', min: 3 },

  // Anestésicos
  { item: 'Anestésico lidocaína 2%', cat: 'Anestésicos', un: 'tubetes', min: 30 },
  { item: 'Anestésico mepivacaína 3%', cat: 'Anestésicos', un: 'tubetes', min: 20 },
  { item: 'Anestésico articaína 4%', cat: 'Anestésicos', un: 'tubetes', min: 20 },
  { item: 'Anestésico tópico (benzocaína)', cat: 'Anestésicos', un: 'potes', min: 2 },
  { item: 'Agulha gengival curta', cat: 'Anestésicos', un: 'caixas', min: 3 },
  { item: 'Agulha gengival longa', cat: 'Anestésicos', un: 'caixas', min: 3 },

  // Restauradores / Dentística
  { item: 'Resina composta A1', cat: 'Restauradores', un: 'seringas', min: 6 },
  { item: 'Resina composta A2', cat: 'Restauradores', un: 'seringas', min: 8 },
  { item: 'Resina composta A3', cat: 'Restauradores', un: 'seringas', min: 6 },
  { item: 'Ácido fosfórico 37%', cat: 'Restauradores', un: 'seringas', min: 4 },
  { item: 'Sistema adesivo', cat: 'Restauradores', un: 'frascos', min: 3 },
  { item: 'Ionômero de vidro', cat: 'Restauradores', un: 'kits', min: 2 },
  { item: 'Tira de poliéster', cat: 'Restauradores', un: 'pacotes', min: 3 },
  { item: 'Matriz metálica', cat: 'Restauradores', un: 'caixas', min: 2 },

  // Prevenção
  { item: 'Flúor gel acidulado', cat: 'Prevenção', un: 'frascos', min: 4 },
  { item: 'Verniz de flúor', cat: 'Prevenção', un: 'bisnagas', min: 3 },
  { item: 'Selante fotopolimerizável', cat: 'Prevenção', un: 'seringas', min: 6 },
  { item: 'Pasta profilática', cat: 'Prevenção', un: 'potes', min: 3 },
  { item: 'Escova de Robinson', cat: 'Prevenção', un: 'pacotes', min: 4 },

  // Endodontia
  { item: 'Hipoclorito de sódio 2,5%', cat: 'Endodontia', un: 'frascos', min: 3 },
  { item: 'Lima endodôntica', cat: 'Endodontia', un: 'caixas', min: 3 },
  { item: 'Cone de papel absorvente', cat: 'Endodontia', un: 'caixas', min: 3 },
  { item: 'Cone de guta-percha', cat: 'Endodontia', un: 'caixas', min: 3 },
  { item: 'Cimento endodôntico', cat: 'Endodontia', un: 'kits', min: 2 },
  { item: 'EDTA', cat: 'Endodontia', un: 'frascos', min: 2 },

  // Cirurgia
  { item: 'Fio de sutura', cat: 'Cirurgia', un: 'caixas', min: 3 },
  { item: 'Lâmina de bisturi', cat: 'Cirurgia', un: 'caixas', min: 2 },
  { item: 'Clorexidina 0,12%', cat: 'Cirurgia', un: 'frascos', min: 3 },
  { item: 'Clorexidina 2%', cat: 'Cirurgia', un: 'frascos', min: 2 },

  // Instrumental rotatório
  { item: 'Broca esférica carbide', cat: 'Instrumental', un: 'unid', min: 6 },
  { item: 'Broca diamantada', cat: 'Instrumental', un: 'unid', min: 6 },
  { item: 'Ponta de ultrassom', cat: 'Instrumental', un: 'unid', min: 3 },

  // Assepsia
  { item: 'Álcool 70%', cat: 'Assepsia', un: 'litros', min: 3 },
  { item: 'Detergente enzimático', cat: 'Assepsia', un: 'frascos', min: 2 },
  { item: 'Bicarbonato de sódio (jato)', cat: 'Assepsia', un: 'pacotes', min: 3 },

  // Harmonização Orofacial (estético)
  { item: 'Toxina botulínica', cat: 'Harmonização', un: 'frascos', min: 4 },
  { item: 'Ácido hialurônico (preenchedor)', cat: 'Harmonização', un: 'seringas', min: 4 },
  { item: 'Bioestimulador de colágeno', cat: 'Harmonização', un: 'frascos', min: 2 },
  { item: 'Microcânula', cat: 'Harmonização', un: 'unid', min: 10 },
  { item: 'Agulha ultrafina 30G', cat: 'Harmonização', un: 'caixas', min: 3 },
  { item: 'Seringa 1ml luer lock', cat: 'Harmonização', un: 'unid', min: 20 },
  { item: 'Solução fisiológica 0,9%', cat: 'Harmonização', un: 'frascos', min: 5 },
  { item: 'Gel pós-procedimento', cat: 'Harmonização', un: 'bisnagas', min: 3 },
]
