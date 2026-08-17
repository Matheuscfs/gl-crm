/**
 * Inventário real do consultório, organizado por área (contagem de 17/08/2026).
 *
 * `min` é a SUGESTÃO de estoque mínimo (ponto de reposição) calculada a partir
 * do giro típico de cada material — os itens entram no estoque marcados como
 * `minAuto: true` ("mínimo sugerido") até serem confirmados na tela de Estoque.
 * Confirmar (ou editar) o mínimo limpa a marca.
 *
 * Um item "precisa comprar" quando a quantidade em mãos fica abaixo do mínimo.
 */

export interface AreaInfo {
  /** Nome da área — é o valor gravado em `cat` de cada item do estoque. */
  key: string
  /** Nome longo, usado nos cartões do modo tablet. */
  label: string
  emoji: string
  /** Cor forte (número, ícone). */
  color: string
  /** Fundo suave do ícone/cartão. */
  bg: string
}

export const AREAS: AreaInfo[] = [
  { key: 'Biossegurança', label: 'Biossegurança e materiais gerais', emoji: '🧤', color: '#0f9d8f', bg: '#e2f6f3' },
  { key: 'Anestesia', label: 'Anestesia', emoji: '💉', color: '#e0344f', bg: '#fdeaed' },
  { key: 'Profilaxia', label: 'Profilaxia e prevenção', emoji: '🪥', color: '#0091b3', bg: '#e2f4f9' },
  { key: 'Odontopediatria', label: 'Odontopediatria', emoji: '👶', color: '#d97706', bg: '#fdf1e2' },
  { key: 'Dentística', label: 'Dentística / Restauradora', emoji: '🦷', color: '#4f52d6', bg: '#ecedfc' },
  { key: 'Endodontia', label: 'Endodontia', emoji: '🧪', color: '#9333ea', bg: '#f4eafd' },
  { key: 'Isolamento', label: 'Isolamento absoluto', emoji: '🛡️', color: '#2563eb', bg: '#e7eefe' },
  { key: 'Radiologia', label: 'Radiologia', emoji: '🩻', color: '#546376', bg: '#eef1f5' },
  { key: 'Clareamento', label: 'Clareamento', emoji: '✨', color: '#b8860b', bg: '#fbf3dd' },
  { key: 'Laboratório', label: 'Prótese / Laboratório', emoji: '🧰', color: '#c2478a', bg: '#fdeaf3' },
  // áreas sem contagem física ainda — existem no catálogo de compras (ver catalog.ts)
  { key: 'Cirurgia', label: 'Cirurgia', emoji: '🩹', color: '#c2410c', bg: '#fdece3' },
  { key: 'Instrumental', label: 'Instrumental rotatório', emoji: '⚙️', color: '#4d7c0f', bg: '#eef5e3' },
  { key: 'Assepsia', label: 'Assepsia e limpeza', emoji: '🧴', color: '#059669', bg: '#e6f6ef' },
  { key: 'Harmonização', label: 'Harmonização orofacial', emoji: '💎', color: '#db2777', bg: '#fdeaf3' },
]

/** Cor neutra para categorias fora da lista (materiais criados à mão). */
export const AREA_PADRAO: Omit<AreaInfo, 'key' | 'label'> = { emoji: '📦', color: '#5b647a', bg: '#eef1f7' }

export const areaInfo = (cat: string): AreaInfo | undefined => AREAS.find((a) => a.key === cat)

export interface InventarioItem {
  item: string
  /** Área — casa com `AreaInfo.key`. */
  cat: string
  qtd: number
  un: string
  /** Estoque mínimo sugerido (ponto de reposição). */
  min: number
}

export const INVENTARIO: InventarioItem[] = [
  // 🧤 Biossegurança e materiais gerais
  { item: 'Paramentação cirúrgica', cat: 'Biossegurança', qtd: 5, un: 'kit', min: 3 },
  { item: 'Luva estéril', cat: 'Biossegurança', qtd: 4, un: 'un', min: 4 },
  { item: 'Luva', cat: 'Biossegurança', qtd: 1, un: 'caixa', min: 2 },
  { item: 'Luva polietileno', cat: 'Biossegurança', qtd: 1, un: 'pacote', min: 1 },
  { item: 'Máscara', cat: 'Biossegurança', qtd: 1, un: 'caixa', min: 2 },
  { item: 'Gorro', cat: 'Biossegurança', qtd: 2, un: 'pacote', min: 1 },
  { item: 'Gaze', cat: 'Biossegurança', qtd: 1, un: 'pacote', min: 2 },
  { item: 'Algodão', cat: 'Biossegurança', qtd: 5, un: 'pacote', min: 3 },
  { item: 'Babador', cat: 'Biossegurança', qtd: 2, un: 'pacote', min: 2 },
  { item: 'Sugador', cat: 'Biossegurança', qtd: 1, un: 'pacote', min: 2 },
  { item: 'Cuba cirúrgica', cat: 'Biossegurança', qtd: 3, un: 'un', min: 2 },
  { item: 'Vaselina', cat: 'Biossegurança', qtd: 1, un: 'un', min: 1 },

  // 💉 Anestesia
  { item: 'Seringa 5 ml', cat: 'Anestesia', qtd: 12, un: 'un', min: 6 },
  { item: 'Seringa 20 ml', cat: 'Anestesia', qtd: 5, un: 'un', min: 3 },
  { item: 'Agulha curta', cat: 'Anestesia', qtd: 1, un: 'caixa', min: 1 },
  { item: 'Agulha longa', cat: 'Anestesia', qtd: 1, un: 'caixa', min: 1 },
  { item: 'Lidocaína', cat: 'Anestesia', qtd: 12, un: 'un', min: 10 },
  { item: 'Mepivacaína', cat: 'Anestesia', qtd: 30, un: 'un', min: 20 },
  { item: 'Anestésico tópico', cat: 'Anestesia', qtd: 1, un: 'un', min: 1 },

  // 🪥 Profilaxia e prevenção
  { item: 'Pasta profilática', cat: 'Profilaxia', qtd: 2, un: 'un', min: 2 },
  { item: 'Taça Dino', cat: 'Profilaxia', qtd: 30, un: 'un', min: 15 },
  { item: 'Taça de borracha', cat: 'Profilaxia', qtd: 10, un: 'un', min: 6 },
  { item: 'Escova Robinson', cat: 'Profilaxia', qtd: 5, un: 'un', min: 4 },
  { item: 'Fio dental', cat: 'Profilaxia', qtd: 1, un: 'un', min: 1 },
  { item: 'Evidenciador de placa', cat: 'Profilaxia', qtd: 1, un: 'un', min: 1 },
  { item: 'Pasta c/ flúor infantil', cat: 'Profilaxia', qtd: 1, un: 'un', min: 1 },
  { item: 'Escova clorexidina', cat: 'Profilaxia', qtd: 5, un: 'un', min: 3 },

  // 👶 Odontopediatria
  { item: 'Selante', cat: 'Odontopediatria', qtd: 4, un: 'un', min: 3 },
  { item: 'Coroa de acetato', cat: 'Odontopediatria', qtd: 1, un: 'jogo', min: 1 },
  { item: 'Abridor de lábios inferior', cat: 'Odontopediatria', qtd: 2, un: 'un', min: 1 },
  { item: 'Afastador de lábios inferior', cat: 'Odontopediatria', qtd: 3, un: 'un', min: 2 },
  { item: 'Abridor de silicone', cat: 'Odontopediatria', qtd: 2, un: 'un', min: 2 },
  { item: 'Abridor Molt', cat: 'Odontopediatria', qtd: 1, un: 'un', min: 1 },
  { item: 'Banda 0,5', cat: 'Odontopediatria', qtd: 4, un: 'un', min: 2 },
  { item: 'Banda 0,7', cat: 'Odontopediatria', qtd: 2, un: 'un', min: 2 },
  { item: 'Colgadura', cat: 'Odontopediatria', qtd: 7, un: 'un', min: 4 },

  // 🦷 Dentística / Restauradora
  { item: 'Ácido', cat: 'Dentística', qtd: 4, un: 'un', min: 3 },
  { item: 'Adesivo', cat: 'Dentística', qtd: 1, un: 'un', min: 2 },
  { item: 'Silano', cat: 'Dentística', qtd: 2, un: 'un', min: 1 },
  { item: 'Resina', cat: 'Dentística', qtd: 12, un: 'un', min: 8 },
  { item: 'Microbrush', cat: 'Dentística', qtd: 2, un: 'kit', min: 2 },
  { item: 'Restaurador provisório', cat: 'Dentística', qtd: 1, un: 'un', min: 1 },
  { item: 'RIVA foto', cat: 'Dentística', qtd: 1, un: 'un', min: 1 },
  { item: 'RIVA químico', cat: 'Dentística', qtd: 1, un: 'un', min: 1 },
  { item: 'CIV convencional', cat: 'Dentística', qtd: 1, un: 'un', min: 1 },
  { item: 'Dycal', cat: 'Dentística', qtd: 1, un: 'kit', min: 1 },
  { item: 'Tira dentada', cat: 'Dentística', qtd: 1, un: 'un', min: 1 },
  { item: 'Tira de poliéster', cat: 'Dentística', qtd: 1, un: 'caixa', min: 1 },
  { item: 'Tira de lixa', cat: 'Dentística', qtd: 1, un: 'caixa', min: 1 },
  { item: 'Tira de lixa em aço', cat: 'Dentística', qtd: 1, un: 'caixa', min: 1 },
  { item: 'Disco de lixa', cat: 'Dentística', qtd: 2, un: 'jogo', min: 2 },
  { item: 'Borracha de polimento', cat: 'Dentística', qtd: 2, un: 'kit', min: 1 },
  { item: 'Cunha de madeira', cat: 'Dentística', qtd: 1, un: 'jogo', min: 1 },
  { item: 'Porta matriz', cat: 'Dentística', qtd: 2, un: 'un', min: 1 },
  { item: 'Matriz de Tofflemire', cat: 'Dentística', qtd: 2, un: 'pacote', min: 1 },
  { item: 'Unimatrix', cat: 'Dentística', qtd: 1, un: 'kit', min: 1 },
  { item: 'Pasta de polimento', cat: 'Dentística', qtd: 1, un: 'un', min: 1 },

  // 🧪 Endodontia
  { item: 'Kit endo', cat: 'Endodontia', qtd: 2, un: 'kit', min: 1 },
  { item: 'Cone R7', cat: 'Endodontia', qtd: 1, un: 'caixa', min: 1 },
  { item: 'Cone R8', cat: 'Endodontia', qtd: 1, un: 'caixa', min: 1 },
  { item: 'Papel absorvente 15–40', cat: 'Endodontia', qtd: 1, un: 'jogo', min: 1 },
  { item: 'Papel absorvente 45–80', cat: 'Endodontia', qtd: 1, un: 'jogo', min: 1 },
  { item: 'Cone de guta 15–40', cat: 'Endodontia', qtd: 1, un: 'caixa', min: 1 },
  { item: 'Cone de guta 45–80', cat: 'Endodontia', qtd: 1, un: 'caixa', min: 1 },
  { item: 'Cone de guta F', cat: 'Endodontia', qtd: 1, un: 'caixa', min: 1 },
  { item: 'Lima 21 mm', cat: 'Endodontia', qtd: 1, un: 'jogo', min: 2 },
  { item: 'Lima 25 mm', cat: 'Endodontia', qtd: 2, un: 'jogo', min: 2 },
  { item: 'Lima 31 mm', cat: 'Endodontia', qtd: 1, un: 'jogo', min: 1 },
  { item: 'Condensador McSpadden', cat: 'Endodontia', qtd: 3, un: 'un', min: 2 },
  { item: 'Espaçador digital', cat: 'Endodontia', qtd: 4, un: 'un', min: 2 },
  { item: 'Broca Gates', cat: 'Endodontia', qtd: 2, un: 'kit', min: 1 },
  { item: 'Broca Largo', cat: 'Endodontia', qtd: 1, un: 'kit', min: 1 },

  // 🛡️ Isolamento absoluto
  { item: 'Lençol de borracha', cat: 'Isolamento', qtd: 2, un: 'caixa', min: 2 },
  { item: 'Arco Young', cat: 'Isolamento', qtd: 1, un: 'un', min: 1 },
  { item: 'Arco Young inferior', cat: 'Isolamento', qtd: 1, un: 'un', min: 1 },
  { item: 'Arco de isolamento', cat: 'Isolamento', qtd: 1, un: 'un', min: 1 },
  { item: 'Arco de isolamento inferior', cat: 'Isolamento', qtd: 1, un: 'un', min: 1 },
  { item: 'Bloqueador de oxigênio', cat: 'Isolamento', qtd: 3, un: 'un', min: 2 },
  { item: 'Pinça perfuradora', cat: 'Isolamento', qtd: 2, un: 'un', min: 1 },
  { item: 'Pinça porta-grampo', cat: 'Isolamento', qtd: 2, un: 'un', min: 1 },

  // 🩻 Radiologia
  { item: 'Película periapical', cat: 'Radiologia', qtd: 50, un: 'un', min: 30 },
  { item: 'Película oclusal', cat: 'Radiologia', qtd: 3, un: 'un', min: 3 },
  { item: 'Posicionador radiográfico', cat: 'Radiologia', qtd: 2, un: 'kit', min: 1 },

  // ✨ Clareamento
  { item: 'Clareador consultório', cat: 'Clareamento', qtd: 3, un: 'kit', min: 2 },
  { item: 'Clareador caseiro', cat: 'Clareamento', qtd: 8, un: 'un', min: 4 },
  { item: 'Abridor de clareamento', cat: 'Clareamento', qtd: 1, un: 'un', min: 1 },
  { item: 'Barreira gengival', cat: 'Clareamento', qtd: 2, un: 'un', min: 2 },

  // 🧰 Prótese / Laboratório
  { item: 'Cera 7', cat: 'Laboratório', qtd: 1, un: 'un', min: 1 },
  { item: 'Cera utilidade', cat: 'Laboratório', qtd: 1, un: 'un', min: 1 },
  { item: 'Acrílico 62', cat: 'Laboratório', qtd: 1, un: 'un', min: 1 },
  { item: 'Acrílico rosa', cat: 'Laboratório', qtd: 1, un: 'un', min: 1 },
  { item: 'Placa de vidro', cat: 'Laboratório', qtd: 2, un: 'un', min: 1 },
  { item: 'Pote Dappen', cat: 'Laboratório', qtd: 6, un: 'un', min: 3 },
  { item: 'Moldeiras', cat: 'Laboratório', qtd: 2, un: 'jogo', min: 1 },
]

/** Data da contagem que originou o inventário — vira a "última entrada" dos itens. */
export const INVENTARIO_DATA = '17/08'
