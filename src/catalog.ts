/**
 * Catálogo de materiais para autocompletar o cadastro de estoque
 * (categoria / unidade / mínimo sugerido ao digitar o nome do material).
 *
 * Fonte principal: o inventário real do consultório (`inventario.ts`).
 * `CATALOGO_EXTRA` acrescenta materiais que ainda não estão na contagem física
 * mas podem ser comprados (cirurgia, assepsia, harmonização orofacial).
 */
import { INVENTARIO } from './inventario'

export interface CatalogItem {
  item: string
  cat: string
  un: string
  min: number
}

const CATALOGO_EXTRA: CatalogItem[] = [
  // Biossegurança (não entram na contagem por área, mas são comprados)
  { item: 'Óculos de proteção', cat: 'Biossegurança', un: 'un', min: 2 },
  { item: 'Filme PVC protetor', cat: 'Biossegurança', un: 'rolo', min: 3 },
  { item: 'Envelope para autoclave', cat: 'Biossegurança', un: 'caixa', min: 3 },
  { item: 'Copo descartável', cat: 'Biossegurança', un: 'pacote', min: 5 },

  // Anestesia
  { item: 'Articaína 4%', cat: 'Anestesia', un: 'un', min: 10 },

  // Profilaxia
  { item: 'Flúor gel acidulado', cat: 'Profilaxia', un: 'un', min: 2 },
  { item: 'Verniz de flúor', cat: 'Profilaxia', un: 'un', min: 2 },

  // Endodontia
  { item: 'Hipoclorito de sódio 2,5%', cat: 'Endodontia', un: 'un', min: 2 },
  { item: 'EDTA', cat: 'Endodontia', un: 'un', min: 2 },
  { item: 'Cimento endodôntico', cat: 'Endodontia', un: 'kit', min: 1 },

  // Cirurgia
  { item: 'Fio de sutura', cat: 'Cirurgia', un: 'caixa', min: 2 },
  { item: 'Lâmina de bisturi', cat: 'Cirurgia', un: 'caixa', min: 1 },
  { item: 'Clorexidina 0,12%', cat: 'Cirurgia', un: 'un', min: 2 },
  { item: 'Clorexidina 2%', cat: 'Cirurgia', un: 'un', min: 1 },

  // Instrumental rotatório
  { item: 'Broca esférica carbide', cat: 'Instrumental', un: 'un', min: 6 },
  { item: 'Broca diamantada', cat: 'Instrumental', un: 'un', min: 6 },
  { item: 'Ponta de ultrassom', cat: 'Instrumental', un: 'un', min: 3 },

  // Assepsia
  { item: 'Álcool 70%', cat: 'Assepsia', un: 'litro', min: 3 },
  { item: 'Detergente enzimático', cat: 'Assepsia', un: 'un', min: 2 },
  { item: 'Bicarbonato de sódio (jato)', cat: 'Assepsia', un: 'pacote', min: 3 },

  // Harmonização orofacial
  { item: 'Toxina botulínica', cat: 'Harmonização', un: 'frasco', min: 4 },
  { item: 'Ácido hialurônico (preenchedor)', cat: 'Harmonização', un: 'seringa', min: 4 },
  { item: 'Bioestimulador de colágeno', cat: 'Harmonização', un: 'frasco', min: 2 },
  { item: 'Microcânula', cat: 'Harmonização', un: 'un', min: 10 },
  { item: 'Agulha ultrafina 30G', cat: 'Harmonização', un: 'caixa', min: 3 },
  { item: 'Seringa 1ml luer lock', cat: 'Harmonização', un: 'un', min: 20 },
  { item: 'Solução fisiológica 0,9%', cat: 'Harmonização', un: 'frasco', min: 5 },
  { item: 'Gel pós-procedimento', cat: 'Harmonização', un: 'un', min: 3 },
]

const doInventario: CatalogItem[] = INVENTARIO.map(({ item, cat, un, min }) => ({ item, cat, un, min }))
const nomes = new Set(doInventario.map((c) => c.item.toLowerCase()))

export const stockCatalog: CatalogItem[] = [
  ...doInventario,
  ...CATALOGO_EXTRA.filter((c) => !nomes.has(c.item.toLowerCase())),
]
