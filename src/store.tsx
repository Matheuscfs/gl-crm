import { createContext, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { supabase } from './lib/supabase'
import { mondayOf, addDays, todayISO, brDate } from './lib/dates'
import {
  patients as seedPatients,
  funil as seedFunil,
  estoque as seedEstoque,
  procedimentos as seedProcedimentos,
  horarios as seedHorarios,
  weekEvents as seedWeekEvents,
  movimentacoes as seedMovimentacoes,
  statusDe,
  type Patient,
  type EstoqueStatus,
  type ApptStatus,
  type AgendaEvent,
} from './data'
import { PROC_BOM, type BOMLine } from './lib/bom'
import { DEMO_DATA } from './lib/demo'
import { fmtDur, fmtMoney, parseDurMin, parseMoney } from './lib/fmt'
import type { HorarioDia } from './lib/horarios'
import { inserir, atualizar, apagar, lerTudo, resolverProvisorio, idReal, esquema } from './lib/sync'

export interface EventItem extends AgendaEvent {
  id: string
  date: string
}

const THIS_MONDAY = mondayOf(new Date())
export interface LeadCard {
  id: string
  name: string
  resp: string
  info: string
  /** Canal de captação (Instagram, Indicação, Google…). */
  origem?: string
}
export interface FunilCol {
  stage: string
  cards: LeadCard[]
}
type BaseEstoque = (typeof seedEstoque)[number]
export type EstoqueItem = BaseEstoque & { _id?: string }
/** Paciente com id garantido (uuid do banco, "tmp…" enquanto o insert não volta, "seed-…" na demo). */
export type PatientRow = Patient & { _id: string; _tmp?: string }
export interface Procedimento {
  id: string
  proc: string
  cat: string
  /** Duração em minutos. */
  durMin: number
  /** Valor em reais. */
  val: number
  /** Ficha técnica: materiais consumidos a cada execução (baixa automática no estoque). */
  lines: BOMLine[]
}
export type { HorarioDia } from './lib/horarios'
export interface Movimento {
  id: string
  tipo: string
  desc: string
  when: string
  delta: string
  kind: 'entrada' | 'saida'
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Procedimento da tabela que corresponde ao texto do agendamento (para cobrança e baixa).
 * 1. nome igual (sem acento/maiúsculas); 2. o nome da tabela aparece inteiro no texto
 * ("Restauração resina 55" → "Restauração resina"), o mais longo vence; 3. o texto é o começo de
 * um único nome da tabela ("Restauração" → "Restauração resina"). Não casa "Consulta" com
 * "1ª consulta / avaliação": cobrar o preço errado é pior que não cobrar.
 */
export function matchFicha<T extends { proc: string }>(list: T[], proc: string): T | null {
  const alvo = semAcento(proc ?? '').split('(')[0].trim()
  if (!alvo) return null
  const exato = list.find((f) => semAcento(f.proc) === alvo)
  if (exato) return exato
  const palavra = (texto: string, trecho: string) => new RegExp(`(^|[^a-z0-9])${trecho.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(texto)
  const contidos = list.filter((f) => { const k = semAcento(f.proc); return k.length >= 3 && palavra(alvo, k) })
  if (contidos.length) return contidos.sort((a, b) => b.proc.length - a.proc.length)[0]
  const comecam = list.filter((f) => { const k = semAcento(f.proc); return k.startsWith(alvo) && palavra(k, alvo) })
  return comecam.length === 1 ? comecam[0] : null
}

/** "hoje 14:30" — rótulo curto para o log de movimentações. */
function rotuloQuando(iso?: string): string {
  const d = iso ? new Date(iso) : new Date()
  const p2 = (n: number) => String(n).padStart(2, '0')
  const local = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
  return `${local === todayISO() ? 'hoje' : brDate(local).slice(0, 5)} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

let idSeq = 1000
const nextId = () => `tmp${++idSeq}`

const STAGES = seedFunil.map((c) => c.stage)

export interface RespInput { name: string; rel: string; phone: string; cpf: string; main: boolean }

export type Carga = 'carregando' | 'pronto' | 'erro'

export interface Conclusao {
  /** Já tinha sido cobrado antes: nada foi baixado nem cobrado de novo. */
  jaCobrado: boolean
  itens: number
  valor: number
}

interface Store {
  /** Situação da carga inicial do banco (para mostrar erro com "Tentar de novo"). */
  carga: Carga
  erroCarga: string | null
  recarregar: () => void

  patients: PatientRow[]
  /** Acha o paciente pelo id (inclusive o provisório) ou, para links antigos, pelo nome. */
  findPatient: (key?: string | null) => PatientRow | undefined
  /** Cadastra; devolve o paciente já com o id do banco (ou null se o banco recusou). */
  addPatient: (p: Omit<Patient, 'initials'>, responsaveis?: RespInput[]) => Promise<PatientRow | null>
  updatePatient: (key: string, patch: Partial<Patient>) => Promise<boolean>
  deletePatient: (key: string) => Promise<boolean>

  funil: FunilCol[]
  addLead: (name: string, resp: string, info: string, origem?: string) => Promise<boolean>
  updateLead: (id: string, patch: Partial<LeadCard>) => Promise<boolean>
  deleteLead: (id: string) => Promise<boolean>
  moveLead: (id: string, toStage: number) => Promise<boolean>

  events: EventItem[]
  addAppointment: (date: string, ev: AgendaEvent) => Promise<string | null>
  updateAppointment: (id: string, patch: Partial<EventItem>) => Promise<boolean>
  /** Desmarca (mantém o registro para o histórico de faltas e remarcações). */
  cancelAppointment: (id: string) => Promise<boolean>
  deleteAppointment: (id: string) => Promise<boolean>
  moveAppointment: (id: string, date: string, start: number) => Promise<boolean>
  /** Conclui: baixa o estoque e gera a cobrança uma única vez por atendimento. */
  concluirAtendimento: (id: string) => Promise<Conclusao>

  estoque: EstoqueItem[]
  addEstoque: (item: Omit<BaseEstoque, 'status' | 'minAuto'> & { status?: EstoqueStatus; minAuto?: boolean }) => Promise<boolean>
  /** `key` = id do item (ou o nome, para telas antigas). */
  updateEstoque: (key: string, patch: Partial<BaseEstoque>) => Promise<boolean>
  registrarSaida: (key: string, qtd: number, desc?: string) => Promise<boolean>
  deleteEstoque: (key: string) => Promise<boolean>
  /** Confirma o mínimo sugerido de um (ou de todos os) item(ns) — some a marca "sugerido". */
  confirmarMinimos: (names?: string[]) => void

  movimentos: Movimento[]
  /** Baixa dos materiais da ficha técnica. Devolve quantos itens saíram. */
  baixaProcedimento: (proc: string, ref: string, procId?: string) => number

  /** Gera a parcela do procedimento executado. Devolve o valor cobrado (0 se sem preço ou se falhou). */
  gerarCobranca: (proc: string, patientKey: string, procId?: string) => Promise<number>

  /** Horários de atendimento da clínica (Configurações) — a Agenda os respeita. */
  horarios: HorarioDia[]
  saveHorarios: (rows: HorarioDia[]) => Promise<boolean>

  /** Procedimentos = tabela de preços + ficha técnica (materiais), unificados. */
  procedimentos: Procedimento[]
  addProcedimento: (p: Omit<Procedimento, 'id'>) => string
  updateProcedimento: (id: string, patch: Partial<Procedimento>) => Promise<boolean>
  deleteProcedimento: (id: string) => Promise<boolean>

  anamnese: Record<string, Record<string, unknown>>
  loadAnamnese: (patientId: string) => void
  saveAnamnese: (patientId: string, data: Record<string, unknown>) => Promise<boolean>
}

const StoreCtx = createContext<Store | null>(null)

export function useStore() {
  const s = useContext(StoreCtx)
  if (!s) throw new Error('useStore must be used within StoreProvider')
  return s
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '??'
}

/** Rota da ficha do paciente — pelo id, não pelo nome (renomear não quebra o link). */
export const patientPath = (p: { _id?: string; name: string }, tab?: string) =>
  `/pacientes/${encodeURIComponent(p._id ?? p.name)}${tab ? `/${tab}` : ''}`

export const estoqueStatus = statusDe

/** Um item precisa ser comprado quando está abaixo do mínimo definido. */
export function precisaComprar(e: { qtd: string; min: string }): boolean {
  const m = Number(e.min)
  return m > 0 && Number(e.qtd) < m
}

/** Quanto comprar para voltar ao mínimo (nunca menos que 1 quando faltando). */
export function faltando(e: { qtd: string; min: string }): number {
  return Math.max(0, (Number(e.min) || 0) - (Number(e.qtd) || 0))
}

/* ---------- Seed local (demonstração e fallback) ---------- */
const seedEvents: EventItem[] = seedWeekEvents.flatMap((day, di) => day.map((ev) => ({ ...ev, id: nextId(), date: addDays(THIS_MONDAY, di) })))
const seedFunilCols: FunilCol[] = seedFunil.map((c) => ({ stage: c.stage, cards: c.cards.map((card) => ({ id: nextId(), ...card })) }))
// Procedimentos unificados: tabela de preços (data.ts) + ficha técnica (PROC_BOM), casadas por nome.
const bomList = Object.entries(PROC_BOM).map(([proc, lines]) => ({ proc, lines }))
const usedBom = new Set<string>()
const seedProcs: Procedimento[] = seedProcedimentos.map((p, i) => {
  const m = matchFicha(bomList, p.proc)
  if (m) usedBom.add(m.proc)
  return { id: `seed-proc${i}`, ...p, lines: m ? m.lines.map((l) => ({ ...l })) : [] }
})
// procedimentos que só existiam como ficha técnica (ex.: harmonização) entram na lista unificada
bomList.forEach((b, i) => {
  if (usedBom.has(b.proc)) return
  seedProcs.push({ id: `seed-bom${i}`, proc: b.proc, cat: 'Harmonização', durMin: 30, val: 0, lines: b.lines.map((l) => ({ ...l })) })
})
const seedPatientRows: PatientRow[] = seedPatients.map((p, i) => ({ ...p, _id: `seed-p${i}` }))
const seedEstoqueRows: EstoqueItem[] = seedEstoque.map((e, i) => ({ ...e, _id: `seed-e${i}` }))
const seedMovs: Movimento[] = seedMovimentacoes.map((m, i) => ({ id: `seed-mov${i}`, ...m }))

/* ---------- mapeamentos linha ↔ objeto ---------- */
const patientFromRow = (r: Record<string, any>): PatientRow => ({
  _id: r.id, initials: r.initials ?? initials(r.name), name: r.name, age: r.age ?? '', resp: r.resp ?? '', last: r.last ?? '',
  next: r.next ?? '', tipo: r.tipo ?? 'Particular', status: r.status ?? 'lead', perfil: r.perfil ?? 'pediatrico', late: r.late ?? false,
  birthdate: r.birthdate ?? '', sex: r.sex ?? '', cpf: r.cpf ?? '', phone: r.phone ?? '', respCpf: r.resp_cpf ?? '',
  respPhone: r.resp_phone ?? '', prontuario: r.prontuario ?? '', origem: r.origem ?? '', photoUrl: r.photo_url ?? '',
})
const patientToRow = (p: Partial<Patient>) => ({
  name: p.name, age: p.age, resp: p.resp, last: p.last, next: p.next, tipo: p.tipo, status: p.status, perfil: p.perfil,
  late: p.late, initials: p.name ? initials(p.name) : undefined, birthdate: p.birthdate === undefined ? undefined : (p.birthdate || null),
  sex: p.sex, cpf: p.cpf, phone: p.phone, resp_cpf: p.respCpf, resp_phone: p.respPhone, prontuario: p.prontuario,
  origem: p.origem === undefined ? undefined : (p.origem || null), photo_url: p.photoUrl,
})
const eventFromRow = (r: Record<string, any>): EventItem => ({
  id: r.id, date: (r.date as string) ?? addDays(THIS_MONDAY, r.day ?? 0), start: Number(r.start), dur: Number(r.dur), child: r.child,
  age: r.age ?? '', proc: r.proc ?? '', status: r.status as ApptStatus, kind: (r.kind ?? 'ped') as 'ped' | 'est',
  patientId: r.patient_id ?? undefined, procId: r.procedimento_id ?? undefined, cobradoEm: r.cobrado_em ?? undefined, gcalId: r.gcal_id ?? undefined, confirmadoEm: r.confirmado_em ?? undefined,
})
const estoqueFromRow = (r: Record<string, any>): EstoqueItem => ({
  _id: r.id, item: r.item, cat: r.cat ?? '', qtd: String(r.qtd), min: String(r.min), un: r.un ?? '', valor: r.valor ?? '',
  marca: r.marca ?? '', validade: r.validade ?? '', lote: r.lote ?? '', fornecedor: r.fornecedor ?? '',
  status: (r.status ?? 'ok') as EstoqueStatus, ent: r.ent ?? '', minAuto: !!r.min_auto,
})

export function StoreProvider({ children }: { children: ReactNode }) {
  // dados de pacientes só existem se estiverem no banco (ver lib/demo.ts);
  // estoque, procedimentos e horários são cadastro real e carregam sempre.
  const [patients, setPatients] = useState<PatientRow[]>(DEMO_DATA ? seedPatientRows : [])
  const [funil, setFunil] = useState<FunilCol[]>(DEMO_DATA ? seedFunilCols : STAGES.map((stage) => ({ stage, cards: [] })))
  const [estoque, setEstoque] = useState<EstoqueItem[]>(seedEstoqueRows)
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>(seedProcs)
  const [events, setEvents] = useState<EventItem[]>(DEMO_DATA ? seedEvents : [])
  const [movimentos, setMovimentos] = useState<Movimento[]>(DEMO_DATA ? seedMovs : [])
  const [horarios, setHorarios] = useState<HorarioDia[]>(seedHorarios.map((h) => ({ day: h.d, hours: h.h, closed: !!('off' in h && h.off) })))
  const [anamnese, setAnamnese] = useState<Record<string, Record<string, unknown>>>({})
  const [carga, setCarga] = useState<Carga>(supabase ? 'carregando' : 'pronto')
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)
  /** Colunas da migração 0026 (patient_id, cobrado_em…, stock_movements) existem no banco? */
  const v26 = useRef(false)

  // refs: as ações leem sempre o estado mais novo sem recriar o objeto do store
  const patientsRef = useRef(patients); patientsRef.current = patients
  const eventsRef = useRef(events); eventsRef.current = events
  const estoqueRef = useRef(estoque); estoqueRef.current = estoque
  const procedimentosRef = useRef(procedimentos); procedimentosRef.current = procedimentos
  const funilRef = useRef(funil); funilRef.current = funil

  useEffect(() => {
    const sb = supabase
    if (!sb) return
    let cancelled = false
    setCarga('carregando')
    ;(async () => {
      const sonda = await sb.from('appointments').select('cobrado_em, patient_id, procedimento_id').limit(1)
      v26.current = !sonda.error
      esquema.v26 = v26.current
      const [pR, aR, lR, sR, prR, hR] = await Promise.all([
        lerTudo(() => sb.from('patients').select('*').order('created_at', { ascending: false }), 'patients'),
        lerTudo(() => sb.from('appointments').select('*').order('date', { ascending: true }), 'appointments'),
        lerTudo(() => sb.from('leads').select('*').order('created_at', { ascending: true }), 'leads'),
        lerTudo(() => sb.from('stock_items').select('*').order('created_at', { ascending: false }), 'stock_items'),
        lerTudo(() => sb.from('procedures').select('*').order('created_at', { ascending: true }), 'procedures'),
        lerTudo(() => sb.from('schedule_hours').select('*').order('ord'), 'schedule_hours'),
      ])
      if (cancelled) return
      const erro = [pR, aR, lR, sR, prR, hR].find((r) => r.error)?.error ?? null
      // tabelas vazias: pacientes/agenda/leads ficam vazios; cadastros com seed (estoque,
      // procedimentos, horários) mantêm o local para a tela não ficar em branco
      if (!pR.error) setPatients(pR.data.map(patientFromRow))
      if (!aR.error) setEvents(aR.data.map(eventFromRow))
      if (!lR.error) {
        const cols: FunilCol[] = STAGES.map((stage) => ({ stage, cards: [] }))
        lR.data.forEach((r: any) => { const c = cols[r.stage ?? 0]; if (c) c.cards.push({ id: r.id, name: r.name, resp: r.resp ?? '', info: r.info ?? '', origem: r.origem ?? '' }) })
        setFunil(cols)
      }
      if (!sR.error && sR.data.length > 0) setEstoque(sR.data.map(estoqueFromRow))
      if (!prR.error && prR.data.length > 0) {
        setProcedimentos(prR.data.map((r: any) => {
          const lines = (r.lines as BOMLine[] | null) ?? []
          // ficha técnica ausente no banco: herda a do catálogo local pelo nome
          const fallback = lines.length ? null : matchFicha(bomList, r.proc as string)
          return {
            id: r.id, proc: r.proc, cat: r.cat ?? '',
            durMin: (r.dur_min as number | null) ?? parseDurMin(r.dur as string),
            val: r.valor != null ? Number(r.valor) : parseMoney(r.val as string),
            lines: lines.length ? lines : (fallback ? fallback.lines.map((l) => ({ ...l })) : []),
          }
        }))
      }
      if (!hR.error && hR.data.length > 0) {
        setHorarios(hR.data.map((r: any) => ({ day: r.day as string, hours: (r.hours as string) ?? '', closed: !!r.closed })))
      }
      if (v26.current) {
        const { data } = await sb.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(60)
        if (!cancelled && data) setMovimentos(data.map((m: any) => ({ id: m.id, tipo: m.tipo, desc: m.descricao, when: rotuloQuando(m.created_at), delta: m.delta, kind: m.kind })))
      }
      setErroCarga(erro)
      setCarga(erro ? 'erro' : 'pronto')
    })().catch((e) => { console.error('[supabase] load', e); if (!cancelled) { setErroCarga(String(e?.message ?? e)); setCarga('erro') } })
    return () => { cancelled = true }
  }, [versao])

  // Tempo real: confirmação que chegou pelo WhatsApp (webhook) ou mudança feita em outro aparelho
  // aparece na Agenda sem recarregar. Precisa da migração 0026 (publicação supabase_realtime).
  useEffect(() => {
    const sb = supabase
    if (!sb || carga !== 'pronto' || !v26.current) return
    const canal = sb.channel('gl-agenda')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, (msg) => {
        if (msg.eventType === 'DELETE') {
          const id = (msg.old as { id?: string }).id
          if (id) setEvents((prev) => prev.filter((e) => e.id !== id))
          return
        }
        const ev = eventFromRow(msg.new as Record<string, unknown>)
        setEvents((prev) => (prev.some((e) => e.id === ev.id) ? prev.map((e) => (e.id === ev.id ? { ...e, ...ev } : e)) : [...prev, ev]))
      })
      .subscribe()
    return () => { void sb.removeChannel(canal) }
  }, [carga])

  const store = useMemo<Store>(() => {
    const findPatient = (key?: string | null) => {
      if (!key) return undefined
      const k = decodeURIComponent(key)
      const real = idReal(k)
      const lista = patientsRef.current
      return lista.find((p) => p._id === k || p._id === real || p._tmp === k) ?? lista.find((p) => p.name === k)
    }

    const registrarMov = (m: Omit<Movimento, 'id' | 'when'>) => {
      const id = nextId()
      setMovimentos((prev) => [{ ...m, id, when: rotuloQuando() }, ...prev].slice(0, 60))
      if (supabase && v26.current) void inserir('stock_movements', { tipo: m.tipo, descricao: m.desc, delta: m.delta, kind: m.kind })
    }

    const baixa = (proc: string, ref: string, procId?: string) => {
      const ficha = (procId && procedimentosRef.current.find((p) => p.id === procId)) || matchFicha(procedimentosRef.current, proc)
      const bom = ficha?.lines
      if (!bom || bom.length === 0) return 0
      let totalItens = 0
      bom.forEach((line) => {
        if (line.qtd <= 0) return // item reutilizável: aparece na ficha, mas não dá baixa
        const cur = estoqueRef.current.find((e) => e.item.toLowerCase() === line.item.toLowerCase())
        if (!cur) return
        const next = String(Math.max(0, Number(cur.qtd) - line.qtd))
        totalItens += line.qtd
        setEstoque((prev) => prev.map((e) => (e._id === cur._id ? { ...e, qtd: next, status: statusDe(next, e.min) } : e)))
        if (cur._id) void atualizar('stock_items', cur._id, { qtd: Number(next), status: statusDe(next, cur.min) })
      })
      if (totalItens > 0) registrarMov({ tipo: 'Saída', desc: `${proc} · ${ref}`, delta: `−${totalItens} itens`, kind: 'saida' })
      return totalItens
    }

    const cobrar = async (proc: string, patientKey: string, procId?: string) => {
      const procRow = (procId && procedimentosRef.current.find((p) => p.id === procId)) || matchFicha(procedimentosRef.current, proc)
      const val = procRow?.val ?? 0
      if (!val) return 0
      const pat = findPatient(patientKey) ?? patientsRef.current.find((x) => x.name.toLowerCase() === patientKey.toLowerCase())
      // pediátrico: cobrança no nome do responsável; adulto/estético: no próprio paciente
      const resp = pat?.resp && pat.resp !== '—' ? pat.resp.split('·')[0].trim() : (pat?.name ?? patientKey)
      if (!supabase) return val
      const id = await inserir('installments', {
        patient_id: pat && !pat._id.startsWith('tmp') && !pat._id.startsWith('seed') ? pat._id : null,
        resp, ref: procRow?.proc ?? proc, venc: brDate(todayISO()), val: fmtMoney(val), status: 'aberto',
      })
      return id ? val : 0
    }

    /** Atualiza uma linha de uma lista no estado e no banco; desfaz se o banco recusar. */
    async function comDesfazer<T>(
      set: Dispatch<SetStateAction<T[]>>, ref: { current: T[] }, acha: (x: T) => boolean,
      patch: (x: T) => T, grava: (antes: T) => Promise<boolean>,
    ): Promise<boolean> {
      const antes = ref.current.find(acha)
      if (!antes) return false
      set((prev) => prev.map((x) => (acha(x) ? patch(x) : x)))
      const ok = await grava(antes)
      if (!ok) set((prev) => prev.map((x) => (acha(x) ? antes : x)))
      return ok
    }

    return {
      carga, erroCarga,
      recarregar: () => setVersao((v) => v + 1),

      patients,
      findPatient,
      addPatient: async (p, responsaveis) => {
        const temp = nextId()
        const row: PatientRow = { ...p, _id: temp, initials: initials(p.name) }
        setPatients((prev) => [row, ...prev])
        if (!supabase) return row
        const id = await inserir('patients', { ...patientToRow({ ...p, perfil: p.perfil ?? 'pediatrico', late: p.late ?? false }) })
        resolverProvisorio(temp, id)
        if (!id) { setPatients((prev) => prev.filter((x) => x._id !== temp)); return null }
        const final = { ...row, _id: id, _tmp: temp }
        setPatients((prev) => prev.map((x) => (x._id === temp ? { ...x, _id: id, _tmp: temp } : x)))
        if (responsaveis?.length) {
          const { error } = await supabase.from('responsaveis').insert(responsaveis.map((r) => ({ patient_id: id, name: r.name, rel: r.rel, phone: r.phone, cpf: r.cpf, is_main: r.main })))
          if (error) console.error('[supabase] responsaveis', error.message)
        }
        return final
      },
      updatePatient: async (key, patch) => {
        const alvo = findPatient(key)
        if (!alvo) return false
        return comDesfazer(setPatients, patientsRef, (x) => x._id === alvo._id,
          (x) => ({ ...x, ...patch, initials: patch.name ? initials(patch.name) : x.initials }),
          (antes) => atualizar('patients', antes._id, patientToRow(patch)))
      },
      deletePatient: async (key) => {
        const alvo = findPatient(key)
        if (!alvo) return false
        setPatients((prev) => prev.filter((x) => x._id !== alvo._id))
        const ok = await apagar('patients', alvo._id)
        if (!ok) setPatients((prev) => [alvo, ...prev])
        return ok
      },

      funil,
      addLead: async (name, resp, info, origem) => {
        const temp = nextId()
        setFunil((prev) => prev.map((col, i) => (i === 0 ? { ...col, cards: [{ id: temp, name, resp, info, origem }, ...col.cards] } : col)))
        if (!supabase) return true
        const id = await inserir('leads', { name, resp, info, origem: origem || null, stage: 0 })
        resolverProvisorio(temp, id)
        setFunil((prev) => prev.map((col) => ({ ...col, cards: id ? col.cards.map((c) => (c.id === temp ? { ...c, id } : c)) : col.cards.filter((c) => c.id !== temp) })))
        return !!id
      },
      updateLead: async (id, patch) => {
        const antes = funilRef.current
        setFunil((prev) => prev.map((col) => ({ ...col, cards: col.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })))
        const ok = await atualizar('leads', id, { name: patch.name, resp: patch.resp, info: patch.info, origem: patch.origem })
        if (!ok) setFunil(antes)
        return ok
      },
      deleteLead: async (id) => {
        const antes = funilRef.current
        setFunil((prev) => prev.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== id) })))
        const ok = await apagar('leads', id)
        if (!ok) setFunil(antes)
        return ok
      },
      moveLead: async (id, toStage) => {
        const antes = funilRef.current
        setFunil((prev) => {
          let moved: LeadCard | undefined
          const stripped = prev.map((col) => {
            const found = col.cards.find((c) => c.id === id)
            if (found) moved = found
            return { ...col, cards: col.cards.filter((c) => c.id !== id) }
          })
          if (!moved) return prev
          return stripped.map((col, i) => (i === toStage ? { ...col, cards: [moved!, ...col.cards] } : col))
        })
        const ok = await atualizar('leads', id, { stage: toStage })
        if (!ok) setFunil(antes)
        return ok
      },

      events,
      addAppointment: async (date, ev) => {
        const temp = nextId()
        setEvents((prev) => [...prev, { ...ev, id: temp, date }])
        if (!supabase) return temp
        const extra = v26.current ? { patient_id: ev.patientId && !ev.patientId.startsWith('tmp') && !ev.patientId.startsWith('seed') ? ev.patientId : null, procedimento_id: ev.procId && !ev.procId.startsWith('seed') && !ev.procId.startsWith('tmp') ? ev.procId : null } : {}
        const id = await inserir('appointments', { child: ev.child, age: ev.age, proc: ev.proc, status: ev.status, date, start: ev.start, dur: ev.dur, kind: ev.kind ?? 'ped', ...extra })
        resolverProvisorio(temp, id)
        setEvents((prev) => (id ? prev.map((e) => (e.id === temp ? { ...e, id } : e)) : prev.filter((e) => e.id !== temp)))
        return id
      },
      updateAppointment: (id, patch) => comDesfazer(setEvents, eventsRef, (e) => e.id === id, (e) => ({ ...e, ...patch }),
        () => atualizar('appointments', id, {
          child: patch.child, age: patch.age, proc: patch.proc, status: patch.status, start: patch.start, dur: patch.dur, date: patch.date, kind: patch.kind,
          ...(v26.current ? { patient_id: patch.patientId, procedimento_id: patch.procId, cobrado_em: patch.cobradoEm, gcal_id: patch.gcalId } : {}),
        })),
      cancelAppointment: (id) => comDesfazer(setEvents, eventsRef, (e) => e.id === id, (e) => ({ ...e, status: 'desmarcado' as ApptStatus }),
        () => atualizar('appointments', id, { status: 'desmarcado' })),
      deleteAppointment: async (id) => {
        const antes = eventsRef.current.find((e) => e.id === id)
        setEvents((prev) => prev.filter((e) => e.id !== id))
        const ok = await apagar('appointments', id)
        if (!ok && antes) setEvents((prev) => [...prev, antes])
        return ok
      },
      moveAppointment: (id, date, start) => comDesfazer(setEvents, eventsRef, (e) => e.id === id, (e) => ({ ...e, date, start }),
        () => atualizar('appointments', id, { date, start })),
      concluirAtendimento: async (id) => {
        const ev = eventsRef.current.find((e) => e.id === id)
        if (!ev) return { jaCobrado: false, itens: 0, valor: 0 }
        if (ev.cobradoEm) {
          if (ev.status !== 'concluido') await comDesfazer(setEvents, eventsRef, (e) => e.id === id, (e) => ({ ...e, status: 'concluido' as ApptStatus }), () => atualizar('appointments', id, { status: 'concluido' }))
          return { jaCobrado: true, itens: 0, valor: 0 }
        }
        const agora = new Date().toISOString()
        // marca antes de cobrar: um segundo clique durante a gravação já encontra cobradoEm
        setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, status: 'concluido' as ApptStatus, cobradoEm: agora } : e)))
        eventsRef.current = eventsRef.current.map((e) => (e.id === id ? { ...e, status: 'concluido' as ApptStatus, cobradoEm: agora } : e))
        const ok = await atualizar('appointments', id, { status: 'concluido', ...(v26.current ? { cobrado_em: agora } : {}) })
        if (!ok) {
          setEvents((prev) => prev.map((e) => (e.id === id ? ev : e)))
          return { jaCobrado: false, itens: 0, valor: 0 }
        }
        const itens = baixa(ev.proc, ev.child, ev.procId)
        const valor = await cobrar(ev.proc, ev.patientId ?? ev.child, ev.procId)
        return { jaCobrado: false, itens, valor }
      },

      estoque,
      addEstoque: async (item) => {
        const existing = estoqueRef.current.find((e) => e.item.toLowerCase() === item.item.toLowerCase())
        registrarMov({ tipo: 'Entrada', desc: `${item.item}`, delta: `+${item.qtd} ${item.un || existing?.un || 'itens'}`, kind: 'entrada' })
        if (existing) {
          const qtd = String(Number(existing.qtd) + Number(item.qtd || 0))
          const status = statusDe(qtd, existing.min)
          // dados informados na entrada atualizam o cadastro (última compra vale)
          const keep = (novo: string | undefined, velho: string) => (novo?.trim() ? novo : velho)
          const patch = { qtd, ent: item.ent, status, valor: keep(item.valor, existing.valor), marca: keep(item.marca, existing.marca), validade: keep(item.validade, existing.validade), lote: keep(item.lote, existing.lote), fornecedor: keep(item.fornecedor, existing.fornecedor) }
          return comDesfazer(setEstoque, estoqueRef, (e) => e._id === existing._id, (e) => ({ ...e, ...patch }),
            () => existing._id ? atualizar('stock_items', existing._id, { ...patch, qtd: Number(qtd) }) : Promise.resolve(true))
        }
        const temp = nextId()
        const status = item.status ?? statusDe(item.qtd, item.min)
        const minAuto = item.minAuto ?? false
        setEstoque((prev) => [{ _id: temp, ...item, status, minAuto }, ...prev])
        if (!supabase) return true
        const id = await inserir('stock_items', { item: item.item, cat: item.cat, un: item.un, valor: item.valor, marca: item.marca, validade: item.validade, lote: item.lote, fornecedor: item.fornecedor, qtd: Number(item.qtd), min: Number(item.min), min_auto: minAuto, status, ent: item.ent })
        resolverProvisorio(temp, id)
        setEstoque((prev) => (id ? prev.map((e) => (e._id === temp ? { ...e, _id: id } : e)) : prev.filter((e) => e._id !== temp)))
        return !!id
      },
      updateEstoque: async (key, patch) => {
        const cur = estoqueRef.current.find((e) => e._id === key) ?? estoqueRef.current.find((e) => e.item === key)
        if (!cur) return false
        // mexer no mínimo é a confirmação dele: a marca "sugerido" cai
        const minAuto = patch.min !== undefined && patch.min !== cur.min ? false : undefined
        const merged = { ...cur, ...patch, ...(minAuto === false ? { minAuto: false } : {}) }
        const status = statusDe(merged.qtd, merged.min)
        return comDesfazer(setEstoque, estoqueRef, (e) => e._id === cur._id, () => ({ ...merged, status }),
          () => cur._id ? atualizar('stock_items', cur._id, { item: merged.item, cat: merged.cat, un: merged.un, valor: merged.valor, marca: merged.marca, validade: merged.validade, lote: merged.lote, fornecedor: merged.fornecedor, qtd: Number(merged.qtd), min: Number(merged.min), min_auto: minAuto, status }) : Promise.resolve(true))
      },
      confirmarMinimos: (names) => {
        const alvo = new Set(names ?? estoqueRef.current.filter((e) => e.minAuto).map((e) => e.item))
        setEstoque((prev) => prev.map((e) => (alvo.has(e.item) ? { ...e, minAuto: false } : e)))
        estoqueRef.current.forEach((e) => { if (alvo.has(e.item) && e._id) void atualizar('stock_items', e._id, { min_auto: false }) })
      },
      registrarSaida: async (key, qtd, desc) => {
        const cur = estoqueRef.current.find((e) => e._id === key) ?? estoqueRef.current.find((e) => e.item === key)
        if (!cur) return false
        const next = String(Math.max(0, Number(cur.qtd) - qtd))
        const ok = await comDesfazer(setEstoque, estoqueRef, (e) => e._id === cur._id, (e) => ({ ...e, qtd: next, status: statusDe(next, e.min) }),
          () => cur._id ? atualizar('stock_items', cur._id, { qtd: Number(next), status: statusDe(next, cur.min) }) : Promise.resolve(true))
        if (ok) registrarMov({ tipo: 'Saída', desc: desc ?? `Baixa manual · ${cur.item}`, delta: `−${qtd} ${cur.un || 'itens'}`, kind: 'saida' })
        return ok
      },
      deleteEstoque: async (key) => {
        const cur = estoqueRef.current.find((e) => e._id === key) ?? estoqueRef.current.find((e) => e.item === key)
        if (!cur) return false
        setEstoque((prev) => prev.filter((e) => e._id !== cur._id))
        const ok = cur._id ? await apagar('stock_items', cur._id) : true
        if (!ok) setEstoque((prev) => [cur, ...prev])
        return ok
      },

      movimentos,
      baixaProcedimento: baixa,
      gerarCobranca: cobrar,

      horarios,
      saveHorarios: async (rows) => {
        const antes = horarios
        setHorarios(rows)
        if (!supabase) return true
        const { error } = await supabase.from('schedule_hours').upsert(rows.map((h, i) => ({ day: h.day, hours: h.hours, closed: h.closed, ord: i })), { onConflict: 'day' })
        if (error) { console.error('[supabase] schedule_hours', error.message); setHorarios(antes); return false }
        return true
      },

      procedimentos,
      addProcedimento: (p) => {
        const temp = nextId()
        setProcedimentos((prev) => [...prev, { id: temp, ...p }])
        // grava numérico + texto legado (dur/val) para compatibilidade
        void inserir('procedures', { proc: p.proc, cat: p.cat, dur_min: p.durMin, valor: p.val, dur: fmtDur(p.durMin), val: fmtMoney(p.val), lines: p.lines })
          .then((id) => {
            resolverProvisorio(temp, id)
            setProcedimentos((prev) => (id ? prev.map((x) => (x.id === temp ? { ...x, id } : x)) : (supabase ? prev.filter((x) => x.id !== temp) : prev)))
          })
        return temp
      },
      updateProcedimento: (id, patch) => {
        const dbPatch: Record<string, unknown> = { proc: patch.proc, cat: patch.cat }
        if (patch.durMin !== undefined) { dbPatch.dur_min = patch.durMin; dbPatch.dur = fmtDur(patch.durMin) }
        if (patch.val !== undefined) { dbPatch.valor = patch.val; dbPatch.val = fmtMoney(patch.val) }
        if (patch.lines !== undefined) dbPatch.lines = patch.lines
        return comDesfazer(setProcedimentos, procedimentosRef, (p) => p.id === id, (p) => ({ ...p, ...patch }), () => atualizar('procedures', id, dbPatch))
      },
      deleteProcedimento: async (id) => {
        const antes = procedimentosRef.current.find((p) => p.id === id)
        setProcedimentos((prev) => prev.filter((p) => p.id !== id))
        const ok = await apagar('procedures', id)
        if (!ok && antes) setProcedimentos((prev) => [...prev, antes])
        return ok
      },

      anamnese,
      loadAnamnese: (patientId) => {
        if (!supabase) return
        supabase.from('anamnese').select('data').eq('patient_id', patientId).maybeSingle().then(({ data, error }) => {
          if (error || !data?.data) return
          setAnamnese((prev) => ({ ...prev, [patientId]: data.data as Record<string, unknown> }))
        })
      },
      saveAnamnese: async (patientId, data) => {
        const antes = anamnese[patientId]
        setAnamnese((prev) => ({ ...prev, [patientId]: data }))
        if (!supabase) return true
        const { error } = await supabase.from('anamnese').upsert({ patient_id: patientId, data }, { onConflict: 'patient_id' })
        if (error) {
          console.error('[supabase] anamnese', error.message)
          setAnamnese((prev) => ({ ...prev, [patientId]: antes ?? {} }))
          return false
        }
        return true
      },
    }
  }, [carga, erroCarga, patients, funil, events, estoque, movimentos, horarios, procedimentos, anamnese])

  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>
}

export type { ApptStatus }
