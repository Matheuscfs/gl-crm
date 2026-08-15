import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './lib/supabase'
import { toastGlobal } from './components/Toast'
import { mondayOf, addDays, todayISO, brDate } from './lib/dates'
import {
  patients as seedPatients,
  funil as seedFunil,
  estoque as seedEstoque,
  procedimentos as seedProcedimentos,
  horarios as seedHorarios,
  weekEvents as seedWeekEvents,
  movimentacoes as seedMovimentacoes,
  type Patient,
  type EstoqueStatus,
  type ApptStatus,
  type AgendaEvent,
} from './data'
import { PROC_BOM, type BOMLine } from './lib/bom'
import { fmtDur, fmtMoney, parseDurMin, parseMoney } from './lib/fmt'
import type { HorarioDia } from './lib/horarios'

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
type PatientRow = Patient & { _id?: string }
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
/** Encontra o procedimento cujo nome melhor casa com o informado (para a baixa automática). */
export function matchFicha<T extends { proc: string }>(list: T[], proc: string): T | null {
  if (!proc) return null
  const norm = proc.toLowerCase()
  const exact = list.find((f) => f.proc.toLowerCase() === norm)
  if (exact) return exact
  const base = norm.split('(')[0].trim()
  return list.find((f) => { const k = f.proc.toLowerCase(); return norm.includes(k) || k.includes(base) }) ?? null
}

/** "hoje 14:30" — rótulo curto para o log de movimentações. */
function nowLabel(): string {
  const d = new Date()
  return `hoje ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

let idSeq = 1000
const nextId = () => `tmp${++idSeq}`

const STAGES = seedFunil.map((c) => c.stage)

export interface RespInput { name: string; rel: string; phone: string; cpf: string; main: boolean }

interface Store {
  patients: Patient[]
  /** Cadastra o paciente; `responsaveis` (pediátrico) são gravados na tabela `responsaveis` vinculados a ele. */
  addPatient: (p: Omit<Patient, 'initials'>, responsaveis?: RespInput[]) => void
  updatePatient: (name: string, patch: Partial<Patient>) => void
  deletePatient: (name: string) => void

  funil: FunilCol[]
  addLead: (name: string, resp: string, info: string, origem?: string) => void
  updateLead: (id: string, patch: Partial<LeadCard>) => void
  deleteLead: (id: string) => void
  moveLead: (id: string, toStage: number) => void

  events: EventItem[]
  addAppointment: (date: string, ev: AgendaEvent) => void
  updateAppointment: (id: string, patch: Partial<AgendaEvent>) => void
  deleteAppointment: (id: string) => void
  moveAppointment: (id: string, date: string, start: number) => void

  estoque: EstoqueItem[]
  addEstoque: (item: Omit<BaseEstoque, 'status'> & { status?: EstoqueStatus }) => void
  updateEstoque: (name: string, patch: Partial<BaseEstoque>) => void
  registrarSaida: (name: string, qtd: number, desc?: string) => void
  deleteEstoque: (name: string) => void

  movimentos: Movimento[]
  /** Baixa automática dos materiais da ficha técnica ao concluir um atendimento. */
  baixaProcedimento: (proc: string, ref: string) => number

  /** Gera uma conta a receber (parcela) do procedimento executado. Retorna o valor cobrado (0 se sem preço). */
  gerarCobranca: (proc: string, patientName: string) => number

  /** Horários de atendimento da clínica (Configurações) — a Agenda os respeita. */
  horarios: HorarioDia[]
  saveHorarios: (rows: HorarioDia[]) => void

  /** Procedimentos = tabela de preços + ficha técnica (materiais), unificados. */
  procedimentos: Procedimento[]
  addProcedimento: (p: Omit<Procedimento, 'id'>) => string
  updateProcedimento: (id: string, patch: Partial<Procedimento>) => void
  deleteProcedimento: (id: string) => void

  anamnese: Record<string, Record<string, unknown>>
  loadAnamnese: (patientId: string) => void
  saveAnamnese: (patientId: string, data: Record<string, unknown>) => void
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

export function estoqueStatus(qtd: string, min: string): EstoqueStatus {
  const q = Number(qtd)
  const m = Number(min)
  if (Number.isNaN(q) || Number.isNaN(m)) return 'ok'
  if (q <= Math.max(1, Math.floor(m / 2))) return 'critico'
  if (q < m) return 'baixo'
  return 'ok'
}

/* ---------- Supabase helpers (no-op quando não configurado) ---------- */
async function insertRow(table: string, values: Record<string, unknown>): Promise<{ id: string } | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from(table).insert(values).select('id').single()
  if (error) {
    console.error(`[supabase] insert ${table}`, error.message)
    // erro silencioso esconderia perda de dados (o registro some no próximo reload) — avisa o usuário
    toastGlobal(`Não foi possível salvar no banco (${table}): ${error.message}`)
    return null
  }
  return data as { id: string }
}
function updateRow(table: string, id: string, patch: Record<string, unknown>) {
  if (!supabase || id.startsWith('tmp')) return
  supabase.from(table).update(patch).eq('id', id).then(({ error }) => {
    if (error) {
      console.error(`[supabase] update ${table}`, error.message)
      toastGlobal(`Não foi possível salvar no banco (${table}): ${error.message}`)
    }
  })
}
function deleteRow(table: string, id: string) {
  if (!supabase || id.startsWith('tmp')) return
  supabase.from(table).delete().eq('id', id).then(({ error }) => { if (error) console.error(`[supabase] delete ${table}`, error.message) })
}

/* ---------- Seed local (fallback quando o banco não responde) ---------- */
const seedEvents: EventItem[] = seedWeekEvents.flatMap((day, di) => day.map((ev) => ({ ...ev, id: nextId(), date: addDays(THIS_MONDAY, di) })))
const seedFunilCols: FunilCol[] = seedFunil.map((c) => ({ stage: c.stage, cards: c.cards.map((card) => ({ id: nextId(), ...card })) }))
// Procedimentos unificados: tabela de preços (data.ts) + ficha técnica (PROC_BOM), casadas por nome.
const bomList = Object.entries(PROC_BOM).map(([proc, lines]) => ({ proc, lines }))
const usedBom = new Set<string>()
const seedProcs: Procedimento[] = seedProcedimentos.map((p) => {
  const m = matchFicha(bomList, p.proc)
  if (m) usedBom.add(m.proc)
  return { id: nextId(), ...p, lines: m ? m.lines.map((l) => ({ ...l })) : [] }
})
// procedimentos que só existiam como ficha técnica (ex.: harmonização) entram na lista unificada
for (const b of bomList) {
  if (usedBom.has(b.proc)) continue
  seedProcs.push({ id: nextId(), proc: b.proc, cat: 'Harmonização', durMin: 30, val: 0, lines: b.lines.map((l) => ({ ...l })) })
}
const seedPatientRows: PatientRow[] = seedPatients
const seedMovs: Movimento[] = seedMovimentacoes.map((m, i) => ({ id: `seed-mov${i}`, ...m }))

export function StoreProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<PatientRow[]>(seedPatientRows)
  const [funil, setFunil] = useState<FunilCol[]>(seedFunilCols)
  const [estoque, setEstoque] = useState<EstoqueItem[]>(seedEstoque)
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>(seedProcs)
  const [events, setEvents] = useState<EventItem[]>(seedEvents)
  const [movimentos, setMovimentos] = useState<Movimento[]>(seedMovs)
  const [horarios, setHorarios] = useState<HorarioDia[]>(seedHorarios.map((h) => ({ day: h.d, hours: h.h, closed: !!('off' in h && h.off) })))
  const [anamnese, setAnamnese] = useState<Record<string, Record<string, unknown>>>({})

  // refs para lookups por nome/item (mapeando para o id do banco)
  const patientsRef = useRef(patients); patientsRef.current = patients
  const estoqueRef = useRef(estoque); estoqueRef.current = estoque
  const procedimentosRef = useRef(procedimentos); procedimentosRef.current = procedimentos

  // Carrega do Supabase no início; em caso de erro (ex.: tabelas ainda não criadas) mantém o mock.
  useEffect(() => {
    const sb = supabase
    if (!sb) return
    let cancelled = false
    ;(async () => {
      const [pR, aR, lR, sR, prR, hR] = await Promise.all([
        sb.from('patients').select('*').order('created_at', { ascending: false }),
        sb.from('appointments').select('*'),
        sb.from('leads').select('*').order('created_at', { ascending: true }),
        sb.from('stock_items').select('*').order('created_at', { ascending: false }),
        sb.from('procedures').select('*').order('created_at', { ascending: true }),
        sb.from('schedule_hours').select('*').order('ord'),
      ])
      if (cancelled) return
      // guarda de length: tabela existente porém vazia mantém o seed local (senão a tela fica em branco)
      if (!pR.error && pR.data && pR.data.length > 0) {
        setPatients(pR.data.map((r) => ({ _id: r.id, initials: r.initials ?? initials(r.name), name: r.name, age: r.age ?? '', resp: r.resp ?? '', last: r.last ?? '', next: r.next ?? '', tipo: r.tipo ?? 'Particular', status: r.status ?? 'lead', perfil: r.perfil ?? 'pediatrico', late: r.late ?? false, birthdate: r.birthdate ?? '', sex: r.sex ?? '', cpf: r.cpf ?? '', phone: r.phone ?? '', respCpf: r.resp_cpf ?? '', respPhone: r.resp_phone ?? '', prontuario: r.prontuario ?? '', origem: r.origem ?? '', photoUrl: r.photo_url ?? '' })))
      }
      if (!aR.error && aR.data && aR.data.length > 0) {
        setEvents(aR.data.map((r) => ({ id: r.id, date: (r.date as string) ?? addDays(THIS_MONDAY, r.day ?? 0), start: Number(r.start), dur: Number(r.dur), child: r.child, age: r.age ?? '', proc: r.proc ?? '', status: r.status as ApptStatus, kind: (r.kind ?? 'ped') as 'ped' | 'est' })))
      }
      if (!lR.error && lR.data && lR.data.length > 0) {
        const cols: FunilCol[] = STAGES.map((stage) => ({ stage, cards: [] }))
        lR.data.forEach((r) => { const c = cols[r.stage ?? 0]; if (c) c.cards.push({ id: r.id, name: r.name, resp: r.resp ?? '', info: r.info ?? '', origem: r.origem ?? '' }) })
        setFunil(cols)
      }
      if (!sR.error && sR.data && sR.data.length > 0) {
        setEstoque(sR.data.map((r) => ({ _id: r.id, item: r.item, cat: r.cat ?? '', qtd: String(r.qtd), min: String(r.min), un: r.un ?? '', valor: r.valor ?? '', marca: r.marca ?? '', validade: r.validade ?? '', lote: r.lote ?? '', fornecedor: r.fornecedor ?? '', status: (r.status ?? 'ok') as EstoqueStatus, ent: r.ent ?? '' })))
      }
      if (!prR.error && prR.data && prR.data.length > 0) {
        // colunas numéricas novas (dur_min/valor) com fallback de parse dos textos legados
        setProcedimentos(prR.data.map((r) => {
          const lines = (r.lines as BOMLine[] | null) ?? []
          // ficha técnica ausente no banco: herda a do catálogo local (PROC_BOM) pelo nome,
          // senão a baixa automática de estoque não funciona para procedimentos vindos do banco
          const fallback = lines.length ? null : matchFicha(bomList, r.proc as string)
          return {
            id: r.id, proc: r.proc, cat: r.cat ?? '',
            durMin: (r.dur_min as number | null) ?? parseDurMin(r.dur as string),
            val: r.valor != null ? Number(r.valor) : parseMoney(r.val as string),
            lines: lines.length ? lines : (fallback ? fallback.lines.map((l) => ({ ...l })) : []),
          }
        }))
      }
      if (!hR.error && hR.data && hR.data.length > 0) {
        setHorarios(hR.data.map((r) => ({ day: r.day as string, hours: (r.hours as string) ?? '', closed: !!r.closed })))
      }
    })().catch((e) => console.error('[supabase] load', e))
    return () => { cancelled = true }
  }, [])

  const store: Store = {
    patients,
    addPatient: (p, responsaveis) => {
      const temp = nextId()
      const row: PatientRow = { _id: temp, initials: initials(p.name), ...p }
      setPatients((prev) => [row, ...prev])
      insertRow('patients', { name: p.name, age: p.age, resp: p.resp, last: p.last, next: p.next, tipo: p.tipo, status: p.status, perfil: p.perfil ?? 'pediatrico', late: p.late ?? false, initials: row.initials, birthdate: p.birthdate || null, sex: p.sex, cpf: p.cpf, phone: p.phone, resp_cpf: p.respCpf, resp_phone: p.respPhone, prontuario: p.prontuario, origem: p.origem || null })
        .then((d) => {
          if (!d) return
          setPatients((prev) => prev.map((x) => (x._id === temp ? { ...x, _id: d.id } : x)))
          if (responsaveis?.length && supabase) {
            supabase.from('responsaveis').insert(responsaveis.map((r) => ({ patient_id: d.id, name: r.name, rel: r.rel, phone: r.phone, cpf: r.cpf, is_main: r.main })))
              .then(({ error }) => { if (error) console.error('[supabase] responsaveis', error.message) })
          }
        })
    },
    updatePatient: (name, patch) => {
      const id = patientsRef.current.find((x) => x.name === name)?._id
      setPatients((prev) => prev.map((x) => (x.name === name ? { ...x, ...patch, initials: patch.name ? initials(patch.name) : x.initials } : x)))
      if (id) updateRow('patients', id, { name: patch.name, age: patch.age, resp: patch.resp, last: patch.last, next: patch.next, tipo: patch.tipo, status: patch.status, perfil: patch.perfil, late: patch.late, initials: patch.name ? initials(patch.name) : undefined, birthdate: patch.birthdate || undefined, sex: patch.sex, cpf: patch.cpf, phone: patch.phone, resp_cpf: patch.respCpf, resp_phone: patch.respPhone, prontuario: patch.prontuario, origem: patch.origem, photo_url: patch.photoUrl })
    },
    deletePatient: (name) => {
      const id = patientsRef.current.find((x) => x.name === name)?._id
      setPatients((prev) => prev.filter((x) => x.name !== name))
      if (id) deleteRow('patients', id)
    },

    funil,
    addLead: (name, resp, info, origem) => {
      const temp = nextId()
      setFunil((prev) => prev.map((col, i) => (i === 0 ? { ...col, cards: [{ id: temp, name, resp, info, origem }, ...col.cards] } : col)))
      insertRow('leads', { name, resp, info, origem: origem || null, stage: 0 }).then((d) => {
        if (d) setFunil((prev) => prev.map((col) => ({ ...col, cards: col.cards.map((c) => (c.id === temp ? { ...c, id: d.id } : c)) })))
      })
    },
    updateLead: (id, patch) => {
      setFunil((prev) => prev.map((col) => ({ ...col, cards: col.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })))
      updateRow('leads', id, { name: patch.name, resp: patch.resp, info: patch.info, origem: patch.origem })
    },
    deleteLead: (id) => {
      setFunil((prev) => prev.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== id) })))
      deleteRow('leads', id)
    },
    moveLead: (id, toStage) => {
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
      updateRow('leads', id, { stage: toStage })
    },

    events,
    addAppointment: (date, ev) => {
      const temp = nextId()
      setEvents((prev) => [...prev, { ...ev, id: temp, date }])
      insertRow('appointments', { child: ev.child, age: ev.age, proc: ev.proc, status: ev.status, date, start: ev.start, dur: ev.dur, kind: ev.kind ?? 'ped' })
        .then((d) => { if (d) setEvents((prev) => prev.map((e) => (e.id === temp ? { ...e, id: d.id } : e))) })
    },
    updateAppointment: (id, patch) => {
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
      updateRow('appointments', id, { child: patch.child, age: patch.age, proc: patch.proc, status: patch.status, start: patch.start, dur: patch.dur, date: patch.date })
    },
    deleteAppointment: (id) => {
      setEvents((prev) => prev.filter((e) => e.id !== id))
      deleteRow('appointments', id)
    },
    moveAppointment: (id, date, start) => {
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, date, start } : e)))
      updateRow('appointments', id, { date, start })
    },

    estoque,
    addEstoque: (item) => {
      const existing = estoqueRef.current.find((e) => e.item.toLowerCase() === item.item.toLowerCase())
      const entrada = { id: nextId(), tipo: 'Entrada', desc: `${item.item}`, when: nowLabel(), delta: `+${item.qtd} ${item.un || existing?.un || 'itens'}`, kind: 'entrada' as const }
      if (existing) {
        const qtd = String(Number(existing.qtd) + Number(item.qtd || 0))
        const status = estoqueStatus(qtd, existing.min)
        // dados informados na entrada atualizam o cadastro (última compra vale)
        const valor = item.valor?.trim() ? item.valor : existing.valor
        const marca = item.marca?.trim() ? item.marca : existing.marca
        const validade = item.validade?.trim() ? item.validade : existing.validade
        const lote = item.lote?.trim() ? item.lote : existing.lote
        const fornecedor = item.fornecedor?.trim() ? item.fornecedor : existing.fornecedor
        setEstoque((prev) => prev.map((e) => (e.item === existing.item ? { ...e, qtd, ent: item.ent, status, valor, marca, validade, lote, fornecedor } : e)))
        if (existing._id) updateRow('stock_items', existing._id, { qtd: Number(qtd), status, ent: item.ent, valor, marca, validade, lote, fornecedor })
      } else {
        const temp = nextId()
        const status = item.status ?? estoqueStatus(item.qtd, item.min)
        setEstoque((prev) => [{ _id: temp, ...item, status }, ...prev])
        insertRow('stock_items', { item: item.item, cat: item.cat, un: item.un, valor: item.valor, marca: item.marca, validade: item.validade, lote: item.lote, fornecedor: item.fornecedor, qtd: Number(item.qtd), min: Number(item.min), status, ent: item.ent })
          .then((d) => { if (d) setEstoque((prev) => prev.map((e) => (e._id === temp ? { ...e, _id: d.id } : e))) })
      }
      setMovimentos((prev) => [entrada, ...prev].slice(0, 40))
    },
    updateEstoque: (name, patch) => {
      const cur = estoqueRef.current.find((e) => e.item === name)
      setEstoque((prev) => prev.map((e) => { if (e.item !== name) return e; const merged = { ...e, ...patch }; return { ...merged, status: estoqueStatus(merged.qtd, merged.min) } }))
      if (cur?._id) {
        const merged = { ...cur, ...patch }
        updateRow('stock_items', cur._id, { item: merged.item, cat: merged.cat, un: merged.un, valor: merged.valor, marca: merged.marca, validade: merged.validade, lote: merged.lote, fornecedor: merged.fornecedor, qtd: Number(merged.qtd), min: Number(merged.min), status: estoqueStatus(merged.qtd, merged.min) })
      }
    },
    registrarSaida: (name, qtd, desc) => {
      const cur = estoqueRef.current.find((e) => e.item === name)
      const next = cur ? String(Math.max(0, Number(cur.qtd) - qtd)) : '0'
      setEstoque((prev) => prev.map((e) => (e.item === name ? { ...e, qtd: next, status: estoqueStatus(next, e.min) } : e)))
      if (cur?._id) updateRow('stock_items', cur._id, { qtd: Number(next), status: estoqueStatus(next, cur.min) })
      setMovimentos((prev) => [{ id: nextId(), tipo: 'Saída', desc: desc ?? `Baixa manual · ${name}`, when: nowLabel(), delta: `−${qtd} ${cur?.un ?? 'itens'}`, kind: 'saida' as const }, ...prev].slice(0, 40))
    },
    deleteEstoque: (name) => {
      const id = estoqueRef.current.find((e) => e.item === name)?._id
      setEstoque((prev) => prev.filter((e) => e.item !== name))
      if (id) deleteRow('stock_items', id)
    },

    movimentos,
    baixaProcedimento: (proc, ref) => {
      const ficha = matchFicha(procedimentosRef.current, proc)
      const bom = ficha?.lines
      if (!bom || bom.length === 0) return 0
      let totalItens = 0
      bom.forEach((line) => {
        const cur = estoqueRef.current.find((e) => e.item.toLowerCase() === line.item.toLowerCase())
        if (!cur) return
        const next = String(Math.max(0, Number(cur.qtd) - line.qtd))
        totalItens += line.qtd
        setEstoque((prev) => prev.map((e) => (e.item === cur.item ? { ...e, qtd: next, status: estoqueStatus(next, e.min) } : e)))
        if (cur._id) updateRow('stock_items', cur._id, { qtd: Number(next), status: estoqueStatus(next, cur.min) })
      })
      if (totalItens > 0) {
        setMovimentos((prev) => [{ id: nextId(), tipo: 'Saída', desc: `${proc} · ${ref}`, when: nowLabel(), delta: `−${totalItens} itens`, kind: 'saida' as const }, ...prev].slice(0, 40))
      }
      return totalItens
    },

    gerarCobranca: (proc, patientName) => {
      const procRow = matchFicha(procedimentosRef.current, proc)
      const val = procRow?.val ?? 0
      if (!val) return 0
      const pat = patientsRef.current.find((x) => x.name.toLowerCase() === patientName.toLowerCase())
      // pediátrico: cobrança no nome do responsável; adulto/estético: no próprio paciente
      const resp = pat?.resp && pat.resp !== '—' ? pat.resp : (pat?.name ?? patientName)
      insertRow('installments', {
        patient_id: pat?._id && !pat._id.startsWith('tmp') ? pat._id : null,
        resp, ref: procRow?.proc ?? proc, venc: brDate(todayISO()), val: fmtMoney(val), status: 'aberto',
      })
      return val
    },

    horarios,
    saveHorarios: (rows) => {
      setHorarios(rows)
      if (supabase) supabase.from('schedule_hours').upsert(rows.map((h, i) => ({ day: h.day, hours: h.hours, closed: h.closed, ord: i })), { onConflict: 'day' }).then(({ error }) => { if (error) console.error('[supabase] schedule_hours', error.message) })
    },

    procedimentos,
    addProcedimento: (p) => {
      const temp = nextId()
      setProcedimentos((prev) => [...prev, { id: temp, ...p }])
      // grava numérico + texto legado (dur/val) para compatibilidade
      insertRow('procedures', { proc: p.proc, cat: p.cat, dur_min: p.durMin, valor: p.val, dur: fmtDur(p.durMin), val: fmtMoney(p.val), lines: p.lines })
        .then((d) => { if (d) setProcedimentos((prev) => prev.map((x) => (x.id === temp ? { ...x, id: d.id } : x))) })
      return temp
    },
    updateProcedimento: (id, patch) => {
      setProcedimentos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
      const dbPatch: Record<string, unknown> = { proc: patch.proc, cat: patch.cat }
      if (patch.durMin !== undefined) { dbPatch.dur_min = patch.durMin; dbPatch.dur = fmtDur(patch.durMin) }
      if (patch.val !== undefined) { dbPatch.valor = patch.val; dbPatch.val = fmtMoney(patch.val) }
      if (patch.lines !== undefined) dbPatch.lines = patch.lines
      updateRow('procedures', id, dbPatch)
    },
    deleteProcedimento: (id) => {
      setProcedimentos((prev) => prev.filter((p) => p.id !== id))
      deleteRow('procedures', id)
    },

    anamnese,
    loadAnamnese: (patientId) => {
      if (!supabase) return
      supabase.from('anamnese').select('data').eq('patient_id', patientId).maybeSingle().then(({ data, error }) => {
        if (error || !data?.data) return
        setAnamnese((prev) => ({ ...prev, [patientId]: data.data as Record<string, unknown> }))
      })
    },
    saveAnamnese: (patientId, data) => {
      setAnamnese((prev) => ({ ...prev, [patientId]: data }))
      if (supabase) supabase.from('anamnese').upsert({ patient_id: patientId, data }, { onConflict: 'patient_id' }).then(({ error }) => { if (error) console.error('[supabase] anamnese', error.message) })
    },
  }

  return <StoreCtx.Provider value={store}>{children}</StoreCtx.Provider>
}

export type { ApptStatus }
