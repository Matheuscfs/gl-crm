/**
 * Ficha técnica (Bill of Materials) por procedimento — materiais consumidos
 * a cada execução. Usado para exibir a ficha no Estoque e para a baixa
 * automática quando um atendimento é concluído.
 *
 * `item` casa com o nome do material no estoque (para a baixa automática);
 * `qtd` é a quantidade decrementada; `label` é o texto exibido.
 */
export interface BOMLine { item: string; qtd: number; label: string }

export const PROC_BOM: Record<string, BOMLine[]> = {
  'Restauração em resina': [
    { item: 'Lidocaína', qtd: 1, label: '1 tubete' },
    { item: 'Resina', qtd: 1, label: '1 aplicação' },
    { item: 'Ácido', qtd: 1, label: '1 aplicação' },
    { item: 'Adesivo', qtd: 1, label: '1 aplicação' },
    { item: 'Microbrush', qtd: 1, label: '2 un' },
    { item: 'Sugador', qtd: 1, label: '1 un' },
    { item: 'Algodão', qtd: 1, label: '2 un' },
  ],
  'Profilaxia + flúor': [
    { item: 'Pasta profilática', qtd: 1, label: '1 aplicação' },
    { item: 'Pasta c/ flúor infantil', qtd: 1, label: '1 aplicação' },
    { item: 'Escova Robinson', qtd: 1, label: '1 un' },
    { item: 'Taça de borracha', qtd: 1, label: '1 un' },
    { item: 'Sugador', qtd: 1, label: '1 un' },
  ],
  'Selante': [
    { item: 'Selante', qtd: 1, label: '1 aplicação' },
    { item: 'Ácido', qtd: 1, label: '1 aplicação' },
    { item: 'Algodão', qtd: 1, label: '2 un' },
    { item: 'Sugador', qtd: 1, label: '1 un' },
  ],
  'Pulpotomia': [
    { item: 'Lidocaína', qtd: 2, label: '2 tubetes' },
    { item: 'CIV convencional', qtd: 1, label: '1 aplicação' },
    { item: 'Lençol de borracha', qtd: 1, label: '1 folha' },
    { item: 'Sugador', qtd: 1, label: '1 un' },
    { item: 'Algodão', qtd: 1, label: '2 un' },
  ],
  'Extração': [
    { item: 'Lidocaína', qtd: 2, label: '2 tubetes' },
    { item: 'Luva estéril', qtd: 1, label: '1 par' },
    { item: 'Gaze', qtd: 1, label: '1 pacote' },
    { item: 'Paramentação cirúrgica', qtd: 1, label: '1 kit' },
  ],
  'Tratamento endodôntico': [
    { item: 'Mepivacaína', qtd: 2, label: '2 tubetes' },
    { item: 'Lençol de borracha', qtd: 1, label: '1 folha' },
    { item: 'Papel absorvente 15–40', qtd: 1, label: '1 uso' },
    { item: 'Cone de guta 15–40', qtd: 1, label: '1 uso' },
    { item: 'Sugador', qtd: 1, label: '1 un' },
  ],
  'Clareamento de consultório': [
    { item: 'Clareador consultório', qtd: 1, label: '1 sessão' },
    { item: 'Barreira gengival', qtd: 1, label: '1 aplicação' },
    { item: 'Abridor de clareamento', qtd: 0, label: 'reutilizável' },
    { item: 'Gaze', qtd: 1, label: '1 pacote' },
  ],
  'Radiografia periapical': [
    { item: 'Película periapical', qtd: 1, label: '1 un' },
    { item: 'Posicionador radiográfico', qtd: 0, label: 'reutilizável' },
    { item: 'Luva polietileno', qtd: 1, label: '1 un' },
  ],
  'Toxina botulínica': [
    { item: 'Toxina botulínica', qtd: 1, label: '1 frasco (fração)' },
    { item: 'Agulha ultrafina 30G', qtd: 1, label: '1 un' },
    { item: 'Seringa 1ml luer lock', qtd: 1, label: '1 un' },
    { item: 'Luva', qtd: 1, label: '1 par' },
  ],
  'Preenchimento': [
    { item: 'Ácido hialurônico (preenchedor)', qtd: 1, label: '1 seringa' },
    { item: 'Microcânula', qtd: 1, label: '1 un' },
    { item: 'Gel pós-procedimento', qtd: 1, label: '1 aplicação' },
    { item: 'Luva', qtd: 1, label: '1 par' },
  ],
}

export const BOM_PROCS = Object.keys(PROC_BOM)

/** Encontra a ficha técnica cujo nome melhor casa com o procedimento informado. */
export function bomFor(proc: string): BOMLine[] | null {
  const norm = (proc ?? '').trim().toLowerCase()
  if (!norm) return null
  // match direto
  const exact = BOM_PROCS.find((k) => k.toLowerCase() === norm)
  if (exact) return PROC_BOM[exact]
  // match por inclusão (ex.: "Restauração em resina composta (74 O)"); sem o nome antes do
  // parêntese ("(74 O)") não há o que casar — antes isso devolvia a primeira ficha da lista
  const base = norm.split('(')[0].trim()
  const partial = BOM_PROCS.find((k) => norm.includes(k.toLowerCase()) || (base !== '' && k.toLowerCase().includes(base)))
  return partial ? PROC_BOM[partial] : null
}
