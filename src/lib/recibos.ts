/**
 * Recibos emitidos — o paciente/responsável pede, a clínica emite e o registro
 * fica guardado com o que o Carnê-Leão exige (data, CPF e nome do pagador,
 * descrição e valor). O CSV de exportação é o insumo do script de importação
 * no Carnê-Leão (Receita Federal).
 */
import { supabase } from './supabase'
import { todayISO } from './dates'

export type ReciboOrigem = 'parcela' | 'lancamento' | 'avulso'

export interface Recibo {
  id: string
  /** Número sequencial impresso no recibo. */
  number: number
  payerName: string
  payerCpf: string
  description: string
  value: number
  /** Data de emissão (ISO aaaa-mm-dd). */
  issuedOn: string
  origin: ReciboOrigem
  refId?: string
  patientId?: string
  /** Quando o recibo foi lançado no app Receita Saúde (migração 0026). */
  receitaSaudeEm?: string
}

export type ReciboInput = Omit<Recibo, 'id' | 'number' | 'receitaSaudeEm'> & { number?: number }

const ORIGEM_LABEL: Record<ReciboOrigem, string> = {
  parcela: 'Parcela',
  lancamento: 'Lançamento',
  avulso: 'Avulso',
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const fromRow = (r: any): Recibo => ({
  id: r.id,
  number: Number(r.number) || 0,
  payerName: r.payer_name ?? '',
  payerCpf: r.payer_cpf ?? '',
  description: r.description ?? '',
  value: Number(r.value) || 0,
  issuedOn: (r.issued_on as string) ?? todayISO(),
  origin: (r.origin as ReciboOrigem) ?? 'avulso',
  refId: r.ref_id ?? undefined,
  patientId: r.patient_id ?? undefined,
  receitaSaudeEm: r.receita_saude_em ?? undefined,
})

export async function listRecibos(): Promise<Recibo[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('receipts').select('*').order('number', { ascending: false })
  if (error) {
    console.error('[supabase] receipts', error.message)
    return []
  }
  return (data ?? []).map(fromRow)
}

/**
 * Grava o recibo. Sem banco configurado (ou com erro), devolve um recibo local
 * numerado a partir do maior número conhecido — a impressão nunca fica travada.
 */
export async function createRecibo(input: ReciboInput, ultimoNumero: number): Promise<Recibo> {
  const local: Recibo = { id: `tmp-${ultimoNumero + 1}`, number: ultimoNumero + 1, ...input }
  if (!supabase) return local
  const { data, error } = await supabase
    .from('receipts')
    .insert({
      patient_id: input.patientId && !input.patientId.startsWith('tmp') ? input.patientId : null,
      payer_name: input.payerName,
      payer_cpf: input.payerCpf || null,
      description: input.description,
      value: input.value,
      issued_on: input.issuedOn,
      origin: input.origin,
      ref_id: input.refId ?? null,
    })
    .select('*')
    .single()
  if (error || !data) {
    console.error('[supabase] receipts insert', error?.message)
    return local
  }
  return fromRow(data)
}

/** Linhas do CSV no formato que o Carnê-Leão (e o script de importação) espera. */
export const CARNE_LEAO_HEADERS = ['Data', 'Recibo', 'CPF do pagador', 'Nome do pagador', 'Descrição', 'Valor', 'Origem']

export function carneLeaoRows(recibos: Recibo[]): (string | number)[][] {
  return [...recibos]
    .sort((a, b) => a.issuedOn.localeCompare(b.issuedOn))
    .map((r) => [
      r.issuedOn.split('-').reverse().join('/'),
      r.number,
      r.payerCpf,
      r.payerName,
      r.description,
      r.value.toFixed(2).replace('.', ','),
      ORIGEM_LABEL[r.origin],
    ])
}

/**
 * Receita Saúde (Receita Federal): o profissional de saúde pessoa física emite o recibo pelo app
 * e ele já entra no Carnê-Leão. Não há API pública — o sistema deixa os dados prontos para copiar,
 * na ordem do app, e marca o que já foi lançado. Confirme as regras com o contador.
 */
export function textoReceitaSaude(r: Recibo, beneficiario?: { nome: string; cpf?: string }): string {
  const linhas = [
    `CPF do pagador: ${r.payerCpf || '—'}`,
    `Nome do pagador: ${r.payerName}`,
    beneficiario && beneficiario.nome !== r.payerName ? `Beneficiário (paciente): ${beneficiario.nome}${beneficiario.cpf ? ` · CPF ${beneficiario.cpf}` : ''}` : 'Beneficiário: o próprio pagador',
    `Valor: ${r.value.toFixed(2).replace('.', ',')}`,
    `Data do pagamento: ${r.issuedOn.split('-').reverse().join('/')}`,
    `Descrição: ${r.description || 'serviços odontológicos'}`,
  ]
  return linhas.join('\n')
}

export async function marcarReceitaSaude(id: string, lancado: boolean): Promise<string | null> {
  if (!supabase || id.startsWith('tmp')) return null
  const { error } = await supabase.from('receipts').update({ receita_saude_em: lancado ? new Date().toISOString() : null }).eq('id', id)
  return error ? error.message : null
}
