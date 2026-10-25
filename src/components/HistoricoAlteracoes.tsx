import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabase'
import { esquema } from '../lib/sync'

interface Entrada {
  id: number
  tabela: string
  acao: 'INSERT' | 'UPDATE' | 'DELETE'
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  email: string | null
  criado_em: string
}

const TABELAS: Record<string, string> = {
  patients: 'Cadastro', anamnese: 'Anamnese', teeth: 'Odontograma', treatments: 'Atendimento', evolucoes: 'Evolução',
  plan_items: 'Plano de tratamento', installments: 'Parcela', documents: 'Documento', facial_map: 'Mapa facial',
  aplicacoes: 'Aplicação (harmonização)', indices_clinicos: 'Índices clínicos', receipts: 'Recibo', appointments: 'Agendamento',
}
const ACOES = { INSERT: 'criou', UPDATE: 'alterou', DELETE: 'excluiu' }
const TECNICOS = new Set(['id', 'patient_id', 'created_at', 'updated_at', 'created_by', 'initials'])

const fmt = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80)
  return String(v).slice(0, 80)
}

/** Campos que mudaram numa alteração ("nota: antes → depois"). */
function mudancas(e: Entrada): string[] {
  if (e.acao !== 'UPDATE' || !e.antes || !e.depois) return []
  return Object.keys(e.depois)
    .filter((k) => !TECNICOS.has(k) && JSON.stringify(e.antes![k]) !== JSON.stringify(e.depois![k]))
    .slice(0, 5)
    .map((k) => `${k}: ${fmt(e.antes![k])} → ${fmt(e.depois![k])}`)
}

const quando = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Trilha do prontuário: quem criou, alterou ou anulou cada registro clínico do paciente e quando
 * (gatilho de auditoria da migração 0026). Só leitura — ninguém edita o histórico.
 */
export function HistoricoAlteracoes({ open, onClose, patientId, nome }: { open: boolean; onClose: () => void; patientId: string | null; nome?: string }) {
  const [linhas, setLinhas] = useState<Entrada[] | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!open) return
    setLinhas(null)
    setErro('')
    if (!supabase || !patientId) { setLinhas([]); return }
    if (!esquema.v26) { setErro('O histórico de alterações começa a ser gravado depois da migração 0026.'); setLinhas([]); return }
    let cancelled = false
    supabase.from('audit_log').select('*').eq('patient_id', patientId).order('criado_em', { ascending: false }).limit(300)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { setErro(error.message); setLinhas([]); return }
        setLinhas((data ?? []) as Entrada[])
      })
    return () => { cancelled = true }
  }, [open, patientId])

  return (
    <Modal open={open} onClose={onClose} title="Histórico de alterações" subtitle={nome ? `Prontuário de ${nome}` : 'Prontuário'} width={560}>
      {linhas === null && <p className="empty-note">Carregando…</p>}
      {erro && <p className="empty-note">{erro}</p>}
      {linhas && linhas.length === 0 && !erro && <p className="empty-note">{patientId ? 'Nenhuma alteração registrada ainda.' : 'Disponível com o banco ligado.'}</p>}
      {linhas && linhas.length > 0 && (
        <ol className="audit-list">
          {linhas.map((e) => {
            const anulou = e.acao === 'UPDATE' && !e.antes?.anulada_em && !!e.depois?.anulada_em
            return (
              <li key={e.id}>
                <div className="audit-head">
                  <b>{TABELAS[e.tabela] ?? e.tabela}</b> · {anulou ? 'anulou' : ACOES[e.acao]}
                  <span>{quando(e.criado_em)}{e.email ? ` · ${e.email}` : ''}</span>
                </div>
                {anulou && <div className="audit-diff">Motivo: {fmt(e.depois?.anulada_motivo)}</div>}
                {!anulou && mudancas(e).map((m) => <div key={m} className="audit-diff">{m}</div>)}
              </li>
            )
          })}
        </ol>
      )}
    </Modal>
  )
}
