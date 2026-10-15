import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { esquema } from './sync'
import { useStore } from '../store'

/** Configuração da automação (tabela automacao_config, migração 0026). */
export interface AutomacaoConfig {
  whatsapp_ativo: boolean
  confirmacao_horas: number
  cobranca_dias: number[]
  retorno_meses_ped: number
  retoque_meses_est: number
  aniversario: boolean
  pos_atendimento: boolean
  estoque_alerta: boolean
  validade_dias: number
  telefone_alertas: string | null
}

export const AUTOMACAO_PADRAO: AutomacaoConfig = {
  whatsapp_ativo: false, confirmacao_horas: 24, cobranca_dias: [-3, 0, 3], retorno_meses_ped: 6, retoque_meses_est: 4,
  aniversario: true, pos_atendimento: true, estoque_alerta: true, validade_dias: 30, telefone_alertas: null,
}

export interface Mensagem {
  id: string; tipo: string; status: string; telefone: string | null; corpo: string | null; erro: string | null; resposta: string | null
  appointment_id: string | null; patient_id: string | null; created_at: string; enviada_em: string | null
}

/**
 * Estado da automação. `disponivel` = o banco já tem a migração 0026; `ativo` = a clínica ligou o
 * WhatsApp automático em Configurações (as Edge Functions precisam estar publicadas — README).
 */
export function useAutomacao() {
  const { carga } = useStore()
  const [config, setConfig] = useState<AutomacaoConfig>(AUTOMACAO_PADRAO)
  const [carregado, setCarregado] = useState(false)
  const disponivel = !!supabase && esquema.v26

  useEffect(() => {
    if (!supabase || carga !== 'pronto' || !esquema.v26) return
    let cancelled = false
    supabase.from('automacao_config').select('*').eq('key', 'automacao').maybeSingle().then(({ data }) => {
      if (cancelled) return
      if (data) setConfig({ ...AUTOMACAO_PADRAO, ...(data as Partial<AutomacaoConfig>) })
      setCarregado(true)
    })
    return () => { cancelled = true }
  }, [carga])

  const salvar = useCallback(async (novo: AutomacaoConfig): Promise<string | null> => {
    if (!supabase) return 'Sem banco configurado.'
    if (!esquema.v26) return 'Aplique a migração 0026 para ligar a automação.'
    const { error } = await supabase.from('automacao_config').upsert({ key: 'automacao', ...novo, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) return error.message
    setConfig(novo)
    return null
  }, [])

  return { config, setConfig, salvar, disponivel, carregado, ativo: disponivel && config.whatsapp_ativo }
}

/** Mensagens recentes (histórico da automação). */
export async function mensagensRecentes(limite = 40): Promise<Mensagem[]> {
  if (!supabase || !esquema.v26) return []
  const { data, error } = await supabase.from('mensagens').select('*').order('created_at', { ascending: false }).limit(limite)
  if (error) { console.error('[supabase] mensagens', error.message); return [] }
  return (data ?? []) as Mensagem[]
}

/** Pacientes que responderam "remarcar" à confirmação nos últimos dias (para a recepção ligar). */
export function usePedidosRemarcar() {
  const { carga } = useStore()
  const [lista, setLista] = useState<Mensagem[]>([])
  useEffect(() => {
    if (!supabase || carga !== 'pronto' || !esquema.v26) return
    let cancelled = false
    const desde = new Date(Date.now() - 4 * 86_400_000).toISOString()
    supabase.from('mensagens').select('*').eq('tipo', 'confirmacao').eq('resposta', 'remarcar').gte('created_at', desde)
      .then(({ data }) => { if (!cancelled) setLista((data ?? []) as Mensagem[]) })
    return () => { cancelled = true }
  }, [carga])
  return lista
}
