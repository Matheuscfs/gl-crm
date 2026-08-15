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
    { item: 'Anestésico lidocaína 2%', qtd: 1, label: '1 tubete' },
    { item: 'Resina composta A2', qtd: 1, label: '1 aplicação' },
    { item: 'Ácido fosfórico 37%', qtd: 1, label: '1 aplicação' },
    { item: 'Luvas de procedimento M', qtd: 1, label: '1 par' },
    { item: 'Sugador descartável', qtd: 1, label: '1 un' },
    { item: 'Rolo de algodão', qtd: 1, label: '2 un' },
  ],
  'Profilaxia + flúor': [
    { item: 'Pasta profilática', qtd: 1, label: '1 aplicação' },
    { item: 'Flúor gel acidulado', qtd: 1, label: '1 aplicação' },
    { item: 'Escova de Robinson', qtd: 1, label: '1 un' },
    { item: 'Luvas de procedimento M', qtd: 1, label: '1 par' },
    { item: 'Sugador descartável', qtd: 1, label: '1 un' },
  ],
  'Selante': [
    { item: 'Selante fotopolimerizável', qtd: 1, label: '1 aplicação' },
    { item: 'Ácido fosfórico 37%', qtd: 1, label: '1 aplicação' },
    { item: 'Luvas de procedimento M', qtd: 1, label: '1 par' },
    { item: 'Rolo de algodão', qtd: 1, label: '2 un' },
  ],
  'Pulpotomia': [
    { item: 'Anestésico lidocaína 2%', qtd: 2, label: '2 tubetes' },
    { item: 'Ionômero de vidro', qtd: 1, label: '1 aplicação' },
    { item: 'Luvas de procedimento M', qtd: 1, label: '1 par' },
    { item: 'Sugador descartável', qtd: 1, label: '1 un' },
    { item: 'Rolo de algodão', qtd: 1, label: '2 un' },
  ],
  'Extração': [
    { item: 'Anestésico lidocaína 2%', qtd: 2, label: '2 tubetes' },
    { item: 'Fio de sutura', qtd: 1, label: '1 un' },
    { item: 'Gaze estéril', qtd: 1, label: '1 pacote' },
    { item: 'Luvas de procedimento M', qtd: 1, label: '1 par' },
  ],
  'Toxina botulínica': [
    { item: 'Toxina botulínica', qtd: 1, label: '1 frasco (fração)' },
    { item: 'Agulha ultrafina 30G', qtd: 1, label: '1 un' },
    { item: 'Seringa 1ml luer lock', qtd: 1, label: '1 un' },
    { item: 'Luvas de procedimento M', qtd: 1, label: '1 par' },
  ],
  'Preenchimento': [
    { item: 'Ácido hialurônico (preenchedor)', qtd: 1, label: '1 seringa' },
    { item: 'Microcânula', qtd: 1, label: '1 un' },
    { item: 'Gel pós-procedimento', qtd: 1, label: '1 aplicação' },
    { item: 'Luvas de procedimento M', qtd: 1, label: '1 par' },
  ],
}

export const BOM_PROCS = Object.keys(PROC_BOM)

/** Encontra a ficha técnica cujo nome melhor casa com o procedimento informado. */
export function bomFor(proc: string): BOMLine[] | null {
  if (!proc) return null
  const norm = proc.toLowerCase()
  // match direto
  const exact = BOM_PROCS.find((k) => k.toLowerCase() === norm)
  if (exact) return PROC_BOM[exact]
  // match por inclusão (ex.: "Restauração em resina composta (74 O)")
  const partial = BOM_PROCS.find((k) => norm.includes(k.toLowerCase()) || k.toLowerCase().includes(norm.split('(')[0].trim()))
  return partial ? PROC_BOM[partial] : null
}
