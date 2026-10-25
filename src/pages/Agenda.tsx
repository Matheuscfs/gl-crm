import { useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { Icon } from '../icons'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { Field, TextInput, Select, FieldRow } from '../components/Field'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { useStore, matchFicha, type EventItem, type Procedimento } from '../store'
import { dayRange, type Range } from '../lib/horarios'
import { useGoogle } from '../lib/GoogleProvider'
import { pushAppointment, syncAppointment } from '../lib/googleCalendar'
import { usePedidosRemarcar } from '../lib/automacao'
import { PedidosOnline, usePedidosOnline } from './agenda/PedidosOnline'
import { esquema } from '../lib/sync'
import { mondayOf, addDays, addMonths, todayISO, weekColumns, weekRangeLabel, longDate, isoDate, parseISO, brDate } from '../lib/dates'
import { waLink, findPatientForEvent, contactPhone, contactName } from '../lib/whats'
import { msgConfirmacao } from '../lib/mensagens'
import { WaButton } from '../components/ui'
import { fmtDur, fmtMoney } from '../lib/fmt'
import { DateField } from '../components/DateField'
import { SuggestInput, type SuggestOption } from '../components/SuggestInput'
import { Butterfly } from './documents/DocKit'
import { STATUS, timeLabels, fmtHour, AGENDA_START, AGENDA_ROW, PERFIL, perfilToKind, type ApptStatus, type ApptKind, type Patient } from '../data'
import { PatientPhoto } from '../components/PatientPhoto'
import { useMediaQuery } from '../lib/useTablet'

const LEGEND: ApptStatus[] = ['agendado', 'confirmado', 'em_atendimento', 'concluido', 'faltou', 'desmarcado']
const VIEWS: [string, string][] = [['Diária', 'Dia'], ['Semanal', 'Semana'], ['Mensal', 'Mês']]
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const WD_ABBR = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const snapHalf = (h: number) => Math.round(h * 2) / 2
/** Último horário da grade (as etiquetas cobrem AGENDA_START … AGENDA_START + n). */
const AGENDA_END = AGENDA_START + timeLabels.length

type Filtro = 'todos' | 'agendado' | 'confirmado' | 'concluido' | 'faltou'
const FILTROS: { key: Filtro; label: string; alerta?: boolean }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'agendado', label: 'Sem confirmação', alerta: true },
  { key: 'confirmado', label: 'Confirmados' },
  { key: 'concluido', label: 'Concluídos' },
  { key: 'faltou', label: 'Faltas' },
]

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Blocos de 30 min do expediente — as opções do campo "Horário". */
function HourOptions({ range }: { range?: Range }) {
  const slots: number[] = []
  for (let h = AGENDA_START; h < AGENDA_END; h += 0.5) slots.push(h)
  return (
    <>
      {slots.map((h) => (
        <option key={h} value={h} disabled={!!range && (h < range.start || h >= range.end)}>{fmtHour(h)}</option>
      ))}
    </>
  )
}

/**
 * Layout de conflitos: quando dois ou mais atendimentos se sobrepõem no tempo,
 * são exibidos lado a lado (em "faixas") em vez de empilhados. Retorna, por id,
 * a faixa do evento e o total de faixas do seu grupo de sobreposição.
 */
function layoutLanes(events: EventItem[]): Record<string, { lane: number; lanes: number }> {
  const out: Record<string, { lane: number; lanes: number }> = {}
  const sorted = [...events].sort((a, b) => a.start - b.start || a.dur - b.dur)
  let i = 0
  while (i < sorted.length) {
    // agrupa eventos que se encadeiam por sobreposição (cluster)
    const group = [sorted[i]]
    let end = sorted[i].start + sorted[i].dur
    let j = i + 1
    while (j < sorted.length && sorted[j].start < end) {
      group.push(sorted[j])
      end = Math.max(end, sorted[j].start + sorted[j].dur)
      j++
    }
    // aloca cada evento na primeira faixa livre
    const laneEnds: number[] = []
    group.forEach((ev) => {
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= ev.start)
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(0) }
      laneEnds[lane] = ev.start + ev.dur
      out[ev.id] = { lane, lanes: 0 }
    })
    group.forEach((ev) => { out[ev.id].lanes = laneEnds.length })
    i = j
  }
  return out
}

function KindMark({ kind }: { kind?: ApptKind }) {
  if (kind === 'est') return <span title="Estético" style={{ display: 'inline-flex', flex: 'none' }}><Butterfly size={13} color="#b23a7e" /></span>
  if (kind === 'adt') return (
    <span title="Adulto" style={{ display: 'inline-flex', flex: 'none' }}>
      <svg width="12" height="13" viewBox="0 0 24 24" fill="#0f766e" aria-hidden="true"><circle cx="12" cy="7.5" r="3.6" /><path d="M4.5 20c0-4 3.6-6 7.5-6s7.5 2 7.5 6z" /></svg>
    </span>
  )
  return (
    <span title="Pediátrico" style={{ display: 'inline-flex', flex: 'none' }}>
      <svg width="12" height="13" viewBox="0 0 24 24" fill="#5b2196" aria-hidden="true"><path d="M12 3.4c-2.1-1.5-5-1.6-6.7.2-1.9 2-1.6 5.2-.8 8.2.5 1.9.8 3.4 1.1 5 .3 1.8 1.7 3.4 2.6 1.3.6-1.5.6-3.4 1.8-3.4s1.2 1.9 1.8 3.4c.9 2.1 2.3.5 2.6-1.3.3-1.6.6-3.1 1.1-5 .8-3 1.1-6.2-.8-8.2-1.7-1.8-4.6-1.7-6.7-.2z" /></svg>
    </span>
  )
}

/* ---------- busca de paciente e de procedimento (sobre o SuggestInput) ---------- */
function PatientPicker({ value, patients, onType, onPick }: { value: string; patients: Patient[]; onType: (v: string) => void; onPick: (p: Patient) => void }) {
  const opcoes = useMemo<SuggestOption<Patient>[]>(() => patients.map((p) => ({
    value: p.name, key: p._id ?? p.name, item: p,
    sub: `${p.age} · ${PERFIL[p.perfil ?? 'pediatrico'].label}`,
    lead: <span className="avatar" style={{ width: 26, height: 26, font: "600 10px var(--font)" }}>{p.initials}</span>,
  })), [patients])
  return (
    <SuggestInput value={value} options={opcoes} limit={8} chevron={false}
      placeholder="Buscar paciente cadastrado ou digitar novo…" emptyText="Nenhum cadastrado — será um novo nome."
      onChange={onType} onPick={(_, o) => { if (o.item) onPick(o.item) }} />
  )
}

function ProcPicker({ value, procs, onType, onPick }: { value: string; procs: Procedimento[]; onType: (v: string) => void; onPick: (p: Procedimento) => void }) {
  const opcoes = useMemo<SuggestOption<Procedimento>[]>(() => procs.map((p) => ({
    value: p.proc, key: p.id, item: p,
    sub: `${p.cat} · ${fmtDur(p.durMin)}`,
    trail: <span className="tnum" style={{ font: "600 12px var(--font)", color: 'var(--ink)', flex: 'none' }}>{fmtMoney(p.val)}</span>,
  })), [procs])
  return (
    <SuggestInput value={value} options={opcoes} placeholder="Selecione ou digite" emptyText="Sem correspondência — será um novo procedimento."
      onChange={onType} onPick={(_, o) => { if (o.item) onPick(o.item) }} />
  )
}

/** Situação escrita no cartão: "agendado" de hoje em diante é "Sem confirmação". */
const situacao = (e: EventItem) => (e.status === 'agendado' && e.date >= todayISO() ? 'Sem confirmação' : STATUS[e.status].label)
/** Versão curta para caber na coluna da semana (~120 px) ao lado do horário. */
const ROTULO_CURTO: Record<ApptStatus, string> = {
  agendado: 'Agendado', confirmado: 'Confirmado', em_atendimento: 'Em sala', concluido: 'Concluído', faltou: 'Faltou', desmarcado: 'Desmarcado',
}
const situacaoCurta = (e: EventItem) => (e.status === 'agendado' && e.date >= todayISO() ? 'A confirmar' : ROTULO_CURTO[e.status])

/* ---------- evento arrastável + redimensionável ---------- */
function EventCard({ e, onClick, dragging, displayStart, compact }: { e: EventItem; onClick?: () => void; dragging?: boolean; displayStart?: number; compact?: boolean }) {
  const time = displayStart ?? e.start
  const { patients } = useStore()
  // na semana a coluna é estreita: a foto só aparece na visão Diária
  const photo = compact ? undefined : findPatientForEvent(patients, e)?.photoUrl
  const passado = e.date < todayISO()
  return (
    <div onClick={onClick} className={`ev-card ev-${e.status}${passado ? ' passado' : ''}${dragging ? ' dragging' : ''}`}
      title={`${e.child} · ${e.proc} · ${fmtHour(e.start)}–${fmtHour(e.start + e.dur)} · ${situacao(e)}`}>
      {photo && <PatientPhoto src={photo} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flex: 'none', marginTop: 2, boxShadow: '0 0 0 1.5px var(--surface)' }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        {dragging
          ? <span className="ev-meta live">{fmtHour(time)} – {fmtHour(time + e.dur)}</span>
          : <span className="ev-meta"><b>{fmtHour(time)}</b> {compact ? situacaoCurta(e) : situacao(e)}</span>}
        <div className="ev-name"><KindMark kind={e.kind} /> {e.child} <span>{e.age}</span></div>
        <div className="ev-proc">{e.proc}</div>
      </div>
    </div>
  )
}

const HALF_ROW = AGENDA_ROW / 2 // 30 min

function DraggableEvent({ e, onOpen, onResize, lane = 0, lanes = 1, colW = 0, range }: { e: EventItem; onOpen: (e: EventItem) => void; onResize: (id: string, dur: number) => void; lane?: number; lanes?: number; colW?: number; range?: Range }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: e.id })
  // durante o arrasto a duração muda só na tela; o banco recebe uma gravação, ao soltar
  const [durViva, setDurViva] = useState<number | null>(null)
  const startResize = (down: React.PointerEvent) => {
    down.stopPropagation()
    down.preventDefault()
    const y0 = down.clientY
    const dur0 = e.dur
    const teto = Math.min(AGENDA_END, range?.end ?? AGENDA_END) - e.start
    let atual = dur0
    const move = (m: PointerEvent) => {
      atual = Math.min(Math.max(0.5, teto), Math.max(0.5, snapHalf(dur0 + (m.clientY - y0) / AGENDA_ROW)))
      setDurViva(atual)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDurViva(null)
      if (atual !== dur0) onResize(e.id, atual)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const w = 100 / lanes
  // Ajuste em blocos (Google Agenda): vertical trava em 30 min; horizontal trava por coluna (dia).
  const dyHours = transform ? (Math.round(transform.y / HALF_ROW) * HALF_ROW) / AGENDA_ROW : 0
  const lo = Math.max(AGENDA_START, range?.start ?? AGENDA_START)
  const hi = Math.min(AGENDA_END, range?.end ?? AGENDA_END) - e.dur
  const liveStart = Math.max(lo, Math.min(Math.max(lo, hi), snapHalf(e.start + dyHours)))
  const sy = (liveStart - e.start) * AGENDA_ROW // card acompanha o horário travado, dentro do expediente
  const sx = transform ? (colW ? Math.round(transform.x / colW) * colW : transform.x) : 0
  return (
    <div ref={setNodeRef} className="ev-wrap" style={{
      position: 'absolute', left: `calc(${lane * w}% + 4px)`, width: `calc(${w}% - 8px)`,
      top: (e.start - AGENDA_START) * AGENDA_ROW + 1, height: (durViva ?? e.dur) * AGENDA_ROW - 6,
      transform: isDragging ? `translate3d(${sx}px, ${sy}px, 0)` : undefined,
      zIndex: isDragging ? 50 : 1, touchAction: 'none',
    }}>
      <div {...listeners} {...attributes} style={{ height: '100%' }}>
        <EventCard e={e} onClick={() => onOpen(e)} dragging={isDragging} displayStart={isDragging ? liveStart : undefined} compact />
      </div>
      <div className="resize-grip" onPointerDown={startResize} title="Arraste para mudar a duração" />
    </div>
  )
}

/** Bloco de 30 min correspondente ao ponto clicado dentro da grade. */
function slotAtPointer(e: React.MouseEvent<HTMLElement>): number {
  const rect = e.currentTarget.getBoundingClientRect()
  return AGENDA_START + Math.floor((e.clientY - rect.top) / HALF_ROW) / 2
}

/** Faixa tracejada que segue o cursor mostrando onde o agendamento cairia. */
function NewSlotGhost({ hour }: { hour: number }) {
  return <div className="slot-ghost" style={{ top: (hour - AGENDA_START) * AGENDA_ROW + 1, height: HALF_ROW - 3 }}>+ {fmtHour(hour)}</div>
}

/** Fora do expediente fica listrado (como no Google Agenda); dia fechado inteiro também. */
function OffHours({ range }: { range?: Range }) {
  if (!range) return <><div className="off-hours" style={{ top: 0, bottom: 0 }} /><span className="closed-chip">Fechado</span></>
  return (
    <>
      {range.start > AGENDA_START && <div className="off-hours" style={{ top: 0, height: (range.start - AGENDA_START) * AGENDA_ROW }} />}
      {range.end < AGENDA_END && <div className="off-hours" style={{ top: (range.end - AGENDA_START) * AGENDA_ROW, bottom: 0 }} />}
    </>
  )
}

function DayColumn({ iso, today, range, onCreate, children }: { iso: string; today?: boolean; range?: Range; onCreate: (iso: string, hour: number) => void; children: React.ReactNode }) {
  const closed = !range
  const { setNodeRef, isOver } = useDroppable({ id: `col-${iso}`, disabled: closed })
  const [ghost, setGhost] = useState<number | null>(null)
  // só reage ao fundo da coluna: sobre um evento, o alvo é o card (não a coluna)
  const noFundo = (e: React.MouseEvent<HTMLElement>) => e.target === e.currentTarget
  const dentroDoExpediente = (h: number) => !!range && h >= range.start && h < range.end
  // arrastar/redimensionar um card termina em "click" na coluna (o alvo do click vira o
  // ancestral comum): exigir que o clique tenha COMEÇADO no fundo descarta esses casos.
  const abriuNoFundo = useRef(false)
  return (
    <div
      ref={setNodeRef}
      className={`day-col${today ? ' today' : ''}${isOver ? ' over' : ''}${closed ? '' : ' open'}`}
      onMouseMove={(e) => {
        if (closed || !noFundo(e)) return setGhost(null)
        const h = slotAtPointer(e)
        setGhost(dentroDoExpediente(h) ? h : null)
      }}
      onMouseLeave={() => setGhost(null)}
      onMouseDown={(e) => { abriuNoFundo.current = noFundo(e) }}
      onClick={(e) => { if (!abriuNoFundo.current || !noFundo(e)) return; onCreate(iso, slotAtPointer(e)) }}
    >
      <OffHours range={range} />
      {ghost !== null && <NewSlotGhost hour={ghost} />}
      {children}
    </div>
  )
}

const EMPTY = (date: string) => ({ date, hour: '9', dur: '1', child: '', age: '', proc: '', status: 'agendado' as ApptStatus, kind: 'ped' as ApptKind, patientId: '', procId: '' })

export default function Agenda() {
  const [view, setView] = useState('Semanal')
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [monthAnchor, setMonthAnchor] = useState(() => `${todayISO().slice(0, 7)}-01`)
  const { events, patients, procedimentos, horarios, addAppointment, updateAppointment, cancelAppointment, moveAppointment, concluirAtendimento } = useStore()
  const { toast } = useToast()
  const google = useGoogle()
  const pedidosRemarcar = new Set(usePedidosRemarcar().map((m) => m.appointment_id))
  const pedidosOnline = usePedidosOnline()
  const [verPedidos, setVerPedidos] = useState(false)
  // Google Agenda acompanha o app: remarcar, mudar duração/procedimento ou desmarcar atualiza o evento de lá
  const assinaturaGoogle = useRef(new Map<string, string>())
  useEffect(() => {
    if (!google.connected) return
    events.forEach((e) => {
      if (!e.gcalId) return
      const sig = `${e.date}|${e.start}|${e.dur}|${e.proc}|${e.child}|${e.status}`
      const antes = assinaturaGoogle.current.get(e.id)
      assinaturaGoogle.current.set(e.id, sig)
      if (antes && antes !== sig) void syncAppointment(e.gcalId, e)
    })
  }, [events, google.connected])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY(todayISO()))
  const [detail, setDetail] = useState<EventItem | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [dayFocus, setDayFocus] = useState(todayISO())
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const gridRef = useRef<HTMLDivElement>(null)
  const [colW, setColW] = useState(0)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const today = todayISO()
  // celular: lista do dia com faixa de dias (a grade da semana não cabe em 375 px)
  const celular = useMediaQuery('(max-width: 640px)')

  const cols = useMemo(() => weekColumns(weekStart), [weekStart])
  const byDate = useMemo(() => {
    const m: Record<string, EventItem[]> = {}
    events.forEach((e) => { if (filtro === 'todos' || e.status === filtro) (m[e.date] ??= []).push(e) })
    Object.values(m).forEach((l) => l.sort((a, b) => a.start - b.start))
    return m
  }, [events, filtro])
  // duração sugerida por procedimento (durMin numérico → horas, em blocos de 30 min)
  const procDur = useMemo(() => {
    const map: Record<string, number> = {}
    procedimentos.forEach((p) => { if (p.durMin) map[p.proc] = Math.max(0.5, snapHalf(p.durMin / 60)) })
    return map
  }, [procedimentos])

  /* ---------- período visível e contagens dos filtros ---------- */
  const periodo = useMemo(() => {
    if (view === 'Diária') return { de: dayFocus, ate: dayFocus }
    if (view === 'Mensal') {
      const d = parseISO(monthAnchor)
      return { de: monthAnchor, ate: isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }
    }
    return { de: cols[0].iso, ate: cols[cols.length - 1].iso }
  }, [view, dayFocus, monthAnchor, cols])
  const doPeriodo = events.filter((e) => e.date >= periodo.de && e.date <= periodo.ate)
  const contagem = (f: Filtro) => (f === 'todos' ? doPeriodo.length : doPeriodo.filter((e) => e.status === f).length)
  const ativos = doPeriodo.filter((e) => e.status !== 'desmarcado').length
  const semConfirmar = doPeriodo.filter((e) => e.status === 'agendado' && e.date >= today).length

  const rotulo = view === 'Diária'
    ? longDate(dayFocus)
    : view === 'Mensal'
      ? (() => { const d = parseISO(monthAnchor); return `${MONTHS[d.getMonth()][0].toUpperCase()}${MONTHS[d.getMonth()].slice(1)} de ${d.getFullYear()}` })()
      : weekRangeLabel(weekStart)
  const [rotAnterior, rotProximo] = view === 'Diária' ? ['Dia anterior', 'Próximo dia'] : view === 'Mensal' ? ['Mês anterior', 'Próximo mês'] : ['Semana anterior', 'Próxima semana']

  const navegar = (dir: -1 | 1) => {
    if (view === 'Diária') {
      const d = addDays(dayFocus, dir)
      setDayFocus(d)
      setWeekStart(mondayOf(parseISO(d)))
    } else if (view === 'Mensal') {
      setMonthAnchor(addMonths(monthAnchor, dir))
    } else {
      setWeekStart(addDays(weekStart, 7 * dir))
    }
  }
  const irParaHoje = () => {
    setWeekStart(mondayOf(new Date()))
    setDayFocus(today)
    setMonthAnchor(`${today.slice(0, 7)}-01`)
  }
  const trocarVisao = (v: string) => {
    // a Diária abre num dia da semana que estava aberta (hoje, se ela contém hoje)
    if (v === 'Diária' && !cols.some((c) => c.iso === dayFocus)) setDayFocus(cols.find((c) => c.today)?.iso ?? cols[0].iso)
    if (v === 'Mensal') setMonthAnchor(`${(view === 'Diária' ? dayFocus : cols.find((c) => c.today)?.iso ?? weekStart).slice(0, 7)}-01`)
    setView(v)
  }

  // conflito: outro atendimento ativo no mesmo dia cujo intervalo sobrepõe o informado
  const conflictAt = (date: string, start: number, dur: number, excludeId?: string) =>
    events.find((e) => e.date === date && e.id !== excludeId && e.status !== 'desmarcado' && e.status !== 'faltou' && start < e.start + e.dur && e.start < start + dur)

  const openNew = (date?: string, hour?: number) => {
    const d = date ?? today
    const range = dayRange(horarios, d)
    setForm({ ...EMPTY(d), hour: String(hour ?? range?.start ?? 9) })
    setOpen(true)
  }

  /**
   * Clique em um espaço vazio da grade → novo agendamento já no dia e horário clicados.
   * Dia fechado ou fora do expediente não abre: o cadastro seria recusado no salvar.
   */
  const createAt = (iso: string, hour: number) => {
    const range = dayRange(horarios, iso)
    if (!range) return toast('A clínica não atende neste dia. Ajuste em Configurações → Horários.', 'error')
    if (hour < range.start || hour >= range.end) {
      return toast(`Fora do expediente de ${fmtHour(range.start)} – ${fmtHour(range.end)}.`, 'error')
    }
    openNew(iso, hour)
  }

  const submit = async () => {
    if (!form.child.trim()) return toast('Informe o paciente.', 'error')
    if (!form.date) return toast('Informe a data do atendimento.', 'error')
    // respeita os horários de atendimento (Configurações)
    const range = dayRange(horarios, form.date)
    if (!range) return toast('A clínica não atende neste dia.', 'error')
    const start = Number(form.hour), dur = Number(form.dur)
    if (start < range.start || start + dur > range.end) return toast(`Fora do expediente (${fmtHour(range.start)} – ${fmtHour(range.end)}).`, 'error')
    if (saving) return
    setSaving(true)
    const date = form.date
    const ev = {
      start, dur, child: form.child.trim(), age: form.age.trim() || '—', proc: form.proc.trim() || 'Consulta', status: form.status, kind: form.kind,
      patientId: form.patientId || undefined, procId: form.procId || undefined,
    }
    const conf = conflictAt(date, ev.start, ev.dur)
    const id = await addAppointment(date, ev)
    setSaving(false)
    if (!id) return // o aviso do erro já apareceu; o formulário continua aberto
    setOpen(false)
    setWeekStart(mondayOf(parseISO(date)))
    if (conf) toast(`Agendado — atenção: conflito com ${conf.child} às ${fmtHour(conf.start)}.`, 'error')
    else toast('Agendamento criado.')
    if (google.connected) {
      pushAppointment({ date, ...ev }).then((gcal) => {
        if (!gcal) return
        void updateAppointment(id, { gcalId: gcal })
        toast('Evento criado no Google Calendar.', 'info')
      })
    }
  }

  const onDragStart = () => {
    // mede a largura de uma coluna de dia para travar o arrasto horizontal por dia
    const g = gridRef.current
    if (g) setColW((g.clientWidth - 60) / 6)
  }
  const onDragEnd = (e: DragEndEvent) => {
    const ev = events.find((x) => x.id === e.active.id)
    if (!ev) return
    const toDate = e.over ? String(e.over.id).replace('col-', '') : ev.date
    const range = dayRange(horarios, toDate)
    if (!range) { toast('A clínica não atende neste dia.', 'error'); return }
    const lo = Math.max(AGENDA_START, range.start)
    const hi = Math.max(lo, Math.min(AGENDA_END, range.end) - ev.dur)
    const newStart = Math.max(lo, Math.min(hi, snapHalf(ev.start + (e.delta.y || 0) / AGENDA_ROW)))
    if (toDate !== ev.date || newStart !== ev.start) {
      moveAppointment(ev.id, toDate, newStart)
      const c = cols.find((x) => x.iso === toDate)
      const when = `${c ? `${c.d} ${c.n}` : toDate} · ${fmtHour(newStart)}`
      const conf = conflictAt(toDate, newStart, ev.dur, ev.id)
      if (conf) toast(`Remarcado: ${when} — atenção: conflito com ${conf.child} às ${fmtHour(conf.start)}.`, 'error')
      else toast(`Remarcado: ${when}.`)
    }
  }

  const [concluindo, setConcluindo] = useState<EventItem | null>(null)
  const setStatus = async (s: ApptStatus) => {
    if (!detail || detail.status === s) return
    // concluir dá baixa no estoque e gera a cobrança: pede confirmação (uma vez por atendimento)
    if (s === 'concluido' && !detail.cobradoEm) return setConcluindo(detail)
    const ok = await updateAppointment(detail.id, { status: s })
    if (!ok) return
    setDetail({ ...detail, status: s })
    toast(`Status: ${STATUS[s].label}.`, 'info')
  }
  const concluir = async (ev: EventItem) => {
    setConcluindo(null)
    const r = await concluirAtendimento(ev.id)
    setDetail((d) => (d && d.id === ev.id ? { ...d, status: 'concluido', cobradoEm: d.cobradoEm ?? new Date().toISOString() } : d))
    if (r.jaCobrado) return toast('Atendimento concluído (já tinha sido cobrado antes).', 'info')
    const parts: string[] = []
    if (r.itens > 0) parts.push(`${r.itens} itens baixados do estoque`)
    if (r.valor > 0) parts.push(`cobrança de ${fmtMoney(r.valor)} gerada`)
    toast(parts.length ? `Atendimento concluído · ${parts.join(' · ')}.` : 'Atendimento concluído.')
  }
  /** Valor que a conclusão vai cobrar (para a confirmação). */
  const valorDe = (ev: EventItem) => ((ev.procId && procedimentos.find((p) => p.id === ev.procId)) || matchFicha(procedimentos, ev.proc))?.val ?? 0
  // edição direta de um agendamento existente (salva na hora, como o resto do app)
  const patchDetail = async (p: Partial<EventItem>) => {
    if (!detail) return
    const antes = detail
    setDetail({ ...detail, ...p })
    const ok = await updateAppointment(detail.id, p)
    if (!ok) setDetail(antes)
  }

  /** Abre o WhatsApp do responsável (ou do paciente) com a confirmação pronta. */
  const enviarConfirmacao = (e: EventItem) => {
    const p = findPatientForEvent(patients, e)
    const quando = e.date === today ? 'hoje' : e.date === addDays(today, 1) ? 'amanhã' : `em ${brDate(e.date)}`
    const msg = msgConfirmacao(e.child, p, quando, fmtHour(e.start), e.proc, (e.kind ?? 'ped') === 'ped')
    const link = waLink(contactPhone(p), msg)
    if (!link) return toast(`Sem telefone cadastrado para ${e.child}. Complete o cadastro do paciente.`, 'error')
    window.open(link, '_blank', 'noopener')
  }

  /* ---------- painel lateral ---------- */
  const aConfirmar = useMemo(() => events
    .filter((e) => e.status === 'agendado' && e.date >= today && e.date <= addDays(today, 6))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
    .slice(0, 6), [events, today])

  // próximo dia de atendimento a partir de amanhã, com as horas cheias ainda livres
  const livres = useMemo(() => {
    for (let i = 1; i <= 7; i++) {
      const iso = addDays(today, i)
      const r = dayRange(horarios, iso)
      if (!r) continue
      const doDia = events.filter((e) => e.date === iso && e.status !== 'desmarcado' && e.status !== 'faltou')
      const slots: number[] = []
      for (let h = Math.ceil(r.start); h + 1 <= r.end; h++) {
        if (!doDia.some((e) => h < e.start + e.dur && e.start < h + 1)) slots.push(h)
      }
      return { iso, i, slots }
    }
    return null
  }, [events, horarios, today])

  const quandoCurto = (iso: string) => {
    if (iso === today) return 'hoje'
    if (iso === addDays(today, 1)) return 'amanhã'
    const d = parseISO(iso)
    return `${WD_ABBR[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Agenda</h1>
          <p className="topbar-sub" hidden={celular}>
            {plural(ativos, 'atendimento', 'atendimentos')} {view === 'Diária' ? 'neste dia' : view === 'Mensal' ? 'neste mês' : 'nesta semana'}
            {semConfirmar > 0 && ` · ${plural(semConfirmar, 'aguardando confirmação', 'aguardando confirmação')}`}
          </p>
        </div>
        <div className="topbar-actions">
          {!celular && (
            <div className="seg-pill" role="group" aria-label="Visualização">
              {VIEWS.map(([v, rot]) => <button key={v} aria-pressed={v === view} onClick={() => trocarVisao(v)}>{rot}</button>)}
            </div>
          )}
          {esquema.v26 && (
            <button className="btn-soft pedidos-btn" onClick={() => setVerPedidos(true)}>
              Pedidos online{pedidosOnline.pedidos.length > 0 && <span className="nav-badge">{pedidosOnline.pedidos.length}</span>}
            </button>
          )}
          <button className="btn-cta" onClick={() => openNew(celular ? dayFocus : undefined)}><Icon name="plus" size={16} /> {celular ? 'Novo' : 'Novo agendamento'}</button>
        </div>
      </header>
      <PedidosOnline open={verPedidos} onClose={() => setVerPedidos(false)} pedidos={pedidosOnline.pedidos} onMudou={pedidosOnline.recarregar} />

      <div className="page-body">
        {celular ? (
          <AgendaCelular
            dia={dayFocus}
            onDia={setDayFocus}
            eventos={events.filter((e) => e.date === dayFocus && e.status !== 'desmarcado').sort((a, b) => a.start - b.start)}
            contagem={(iso) => events.filter((e) => e.date === iso && e.status !== 'desmarcado').length}
            onOpen={setDetail}
            onConfirmar={enviarConfirmacao}
            onNovo={() => openNew(dayFocus)}
          />
        ) : (
        <div className="cal-cols">
          <section className="panel flush cal-main" aria-label="Calendário">
            <div className="cal-toolbar">
              <div className="cal-nav">
                <button className="nav-arrow" onClick={() => navegar(-1)} aria-label={rotAnterior} title={rotAnterior}><Icon name="chevron" size={16} /></button>
                <button className="nav-arrow" onClick={() => navegar(1)} aria-label={rotProximo} title={rotProximo}><span style={{ display: 'flex', transform: 'scaleX(-1)' }}><Icon name="chevron" size={16} /></span></button>
                <button className="btn-soft" onClick={irParaHoje}>Hoje</button>
                <span className="cal-label">{rotulo}</span>
              </div>
              <div className="seg-sm" role="group" aria-label="Filtrar por situação">
                {FILTROS.map((f) => {
                  const n = contagem(f.key)
                  return (
                    <button key={f.key} aria-pressed={filtro === f.key} onClick={() => setFiltro(f.key)}>
                      {f.label}<span className={`n${f.alerta && n ? ' alert' : ''}`}>{n}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {view === 'Mensal' ? (
              <MonthView anchor={monthAnchor} byDate={byDate} onPick={(iso) => { setDayFocus(iso); setWeekStart(mondayOf(parseISO(iso))); setView('Diária') }} />
            ) : view === 'Diária' ? (
              <DayView iso={dayFocus} cols={weekColumns(mondayOf(parseISO(dayFocus)))} events={byDate[dayFocus] ?? []} range={dayRange(horarios, dayFocus)} onPickDay={setDayFocus} onOpen={setDetail} onCreate={createAt} filtrado={filtro !== 'todos'} />
            ) : (
              <div className="week-scroll">
                <div className="week">
                  <div className="week-head">
                    <div />
                    {cols.map((c) => (
                      <div key={c.iso} className={`week-day${c.today ? ' today' : ''}`}>
                        <span className="d">{c.d}{c.today ? ' · HOJE' : ''}</span>
                        <span className="n">{c.n}</span>
                      </div>
                    ))}
                  </div>

                  <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
                    <div ref={gridRef} className="week-grid">
                      <div className="time-col">
                        {timeLabels.map((t) => <div key={t} className="time-label">{t}</div>)}
                      </div>
                      {cols.map((c) => {
                        const dayEvents = byDate[c.iso] ?? []
                        const lanes = layoutLanes(dayEvents)
                        const range = dayRange(horarios, c.iso)
                        return (
                          <DayColumn key={c.iso} iso={c.iso} today={c.today} range={range} onCreate={createAt}>
                            {dayEvents.map((e) => <DraggableEvent key={e.id} e={e} onOpen={setDetail} onResize={(id, dur) => updateAppointment(id, { dur })} lane={lanes[e.id]?.lane} lanes={lanes[e.id]?.lanes} colW={colW} range={range} />)}
                          </DayColumn>
                        )
                      })}
                    </div>
                  </DndContext>
                </div>
              </div>
            )}
          </section>

          <aside className="cal-aside" aria-label="Pendências da agenda">
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title sm">A confirmar {aConfirmar.length > 0 && <span className="count-pill" style={{ background: 'var(--red-bg)', color: 'var(--danger-text)' }}>{aConfirmar.length}</span>}</h2>
              </div>
              <p className="panel-sub">Próximos 7 dias · mensagem pronta com data e hora.</p>
              {aConfirmar.length === 0 ? (
                <p className="empty-note">Todas as consultas da semana estão confirmadas.</p>
              ) : (
                <div className="list-rows">
                  {aConfirmar.map((e) => {
                    const p = findPatientForEvent(patients, e)
                    return (
                      <div key={e.id} className="list-row">
                        <button className="q-text" style={{ flex: 1, border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={() => setDetail(e)}>
                          <span className="q-main">{e.child}</span>
                          <span className="q-sub">{quandoCurto(e.date)} · {fmtHour(e.start)}{p && contactName(p, '') !== p.name ? ` · ${contactName(p, '')}` : ''}</span>
                        </button>
                        <button className="btn-line" onClick={() => enviarConfirmacao(e)}><Icon name="wa" size={14} /> WhatsApp</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="panel">
              <h2 className="panel-title sm">{livres ? (livres.i === 1 ? 'Horários livres amanhã' : `Horários livres · ${quandoCurto(livres.iso)}`) : 'Horários livres'}</h2>
              <p className="panel-sub">Para encaixe ou para remarcar retornos vencidos.</p>
              {!livres ? (
                <p className="empty-note">Nenhum dia de atendimento nos próximos 7 dias.</p>
              ) : livres.slots.length === 0 ? (
                <p className="empty-note">Dia cheio — nenhuma hora livre.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {livres.slots.map((h) => (
                    <button key={h} className="slot-btn" onClick={() => openNew(livres.iso, h)} aria-label={`Agendar ${quandoCurto(livres.iso)} às ${fmtHour(h)}`}>{fmtHour(h)}</button>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <h2 className="panel-title sm">Legenda</h2>
              <div className="legend" style={{ marginTop: 12, gap: 9 }}>
                <div className="legend-row"><span className="legend-swatch" style={{ background: 'var(--surface)', border: '1.5px dashed var(--red-border)' }} />Sem confirmação (tracejado)</div>
                <div className="legend-row"><span className="legend-swatch" style={{ background: 'var(--primary-bg)', border: '1px solid var(--primary-border)' }} />Confirmado</div>
                <div className="legend-row"><span className="legend-swatch" style={{ background: 'var(--amber-bg)', border: '1px solid color-mix(in srgb, var(--amber) 35%, transparent)' }} />Em atendimento</div>
                <div className="legend-row"><span className="legend-swatch" style={{ background: 'var(--green-bg)', border: '1px solid color-mix(in srgb, var(--green) 35%, transparent)' }} />Concluído</div>
                <div className="legend-row"><span className="legend-swatch" style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)' }} />Faltou</div>
                <div className="legend-row"><span className="legend-swatch" style={{ background: 'var(--bg-soft)', border: '1px solid var(--border-strong)' }} />Desmarcado ou passado</div>
              </div>
            </section>
          </aside>
        </div>
        )}
      </div>

      {/* Novo agendamento */}
      <Modal open={open} onClose={() => setOpen(false)} title="Novo agendamento" subtitle={form.date ? longDate(form.date) : 'Escolha a data'} dirty={!!form.child.trim() || !!form.proc.trim()}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button loading={saving} onClick={submit}>Agendar</Button></>}>
        <Field label="Perfil do atendimento"><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ApptKind })}><option value="ped">Pediátrico</option><option value="est">Estético</option><option value="adt">Adulto</option></Select></Field>
        <Field label="Paciente">
          <PatientPicker value={form.child} patients={patients} onType={(v) => setForm({ ...form, child: v, patientId: '' })} onPick={(p) => setForm({ ...form, child: p.name, age: p.age, kind: perfilToKind(p.perfil), patientId: (p as { _id?: string })._id ?? '' })} />
        </Field>
        <FieldRow>
          <Field label="Idade"><TextInput value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="Ex.: 6a" /></Field>
          <Field label="Procedimento">
            <ProcPicker
              value={form.proc}
              procs={procedimentos}
              onType={(v) => setForm({ ...form, proc: v, procId: '', dur: procDur[v] ? String(procDur[v]) : form.dur })}
              onPick={(p) => setForm({ ...form, proc: p.proc, procId: p.id, dur: procDur[p.proc] ? String(procDur[p.proc]) : form.dur })}
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Data"><DateField value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} /></Field>
          <Field label="Horário"><Select value={form.hour} onChange={(e) => setForm({ ...form, hour: e.target.value })}><HourOptions range={form.date ? dayRange(horarios, form.date) : undefined} /></Select></Field>
        </FieldRow>
        <FieldRow>
          <Field label="Duração"><Select value={form.dur} onChange={(e) => setForm({ ...form, dur: e.target.value })}><option value="0.5">30 min</option><option value="1">1 hora</option><option value="1.5">1h30</option><option value="2">2 horas</option></Select></Field>
          <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ApptStatus })}>{LEGEND.map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}</Select></Field>
        </FieldRow>
      </Modal>

      {/* Detalhe do evento */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.child ?? ''} subtitle={detail ? `${detail.proc} · ${longDate(detail.date)} · ${fmtHour(detail.start)}` : ''} width={420}
        footer={detail ? (<><Button variant="danger" onClick={() => setConfirmDel(true)}>Desmarcar consulta</Button><Button onClick={() => setDetail(null)}>Fechar</Button></>) : undefined}>
        {detail && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Situação do atendimento">
              {LEGEND.map((s) => (
                <button key={s} aria-pressed={detail.status === s} className={`chip ev-${s}`} onClick={() => setStatus(s)}
                  style={{ padding: '6px 11px', borderRadius: 20, font: "600 11.5px var(--font)", border: `1px solid ${detail.status === s ? 'var(--ev-border)' : 'var(--line)'}`, background: detail.status === s ? 'var(--ev-bg)' : 'var(--surface)', color: detail.status === s ? 'var(--ev-fg)' : 'var(--muted)', borderStyle: 'solid' }}>
                  {s === 'agendado' ? 'Sem confirmação' : STATUS[s].label}
                </button>
              ))}
            </div>
            {pedidosRemarcar.has(detail.id) && detail.status === 'agendado' && (
              <div className="notice" role="status"><p className="notice-text"><b>Pediu para remarcar</b> respondendo à confirmação automática. Ligue ou mande mensagem para combinar o novo horário.</p></div>
            )}
            {detail.confirmadoEm && <div style={{ font: '500 12px var(--font)', color: 'var(--green-dark)' }}>Confirmado pelo WhatsApp</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <WaButton onClick={() => enviarConfirmacao(detail)}>Enviar confirmação por WhatsApp</WaButton>
              <span style={{ font: "400 11.5px var(--font)", color: 'var(--muted)' }}>ao responder SIM, marque como Confirmado</span>
            </div>
            <Field label="Perfil do atendimento"><Select value={detail.kind ?? 'ped'} onChange={(e) => patchDetail({ kind: e.target.value as ApptKind })}><option value="ped">Pediátrico</option><option value="est">Estético</option><option value="adt">Adulto</option></Select></Field>
            <Field label="Paciente">
              <PatientPicker value={detail.child} patients={patients} onType={(v) => patchDetail({ child: v })} onPick={(p) => patchDetail({ child: p.name, age: p.age, kind: perfilToKind(p.perfil), patientId: (p as { _id?: string })._id })} />
            </Field>
            <FieldRow>
              <Field label="Idade"><TextInput value={detail.age} onChange={(e) => patchDetail({ age: e.target.value })} placeholder="Ex.: 6a" /></Field>
              <Field label="Procedimento">
                <ProcPicker value={detail.proc} procs={procedimentos} onType={(v) => patchDetail({ proc: v, dur: procDur[v] ?? detail.dur })} onPick={(p) => patchDetail({ proc: p.proc, procId: p.id, dur: procDur[p.proc] ?? detail.dur })} />
              </Field>
            </FieldRow>
            <FieldRow>
              {/* apagar a data não move o atendimento para uma data vazia (ele sumiria da agenda) */}
              <Field label="Data"><DateField value={detail.date} onChange={(iso) => { if (!iso) return; moveAppointment(detail.id, iso, detail.start); setDetail({ ...detail, date: iso }) }} /></Field>
              <Field label="Horário"><Select value={detail.start} onChange={(e) => patchDetail({ start: Number(e.target.value) })}><HourOptions range={dayRange(horarios, detail.date)} /></Select></Field>
            </FieldRow>
            <Field label="Duração"><Select value={String(detail.dur)} onChange={(e) => patchDetail({ dur: Number(e.target.value) })}><option value="0.5">30 min</option><option value="1">1 hora</option><option value="1.5">1h30</option><option value="2">2 horas</option></Select></Field>
          </>
        )}
      </Modal>

      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)}
        onConfirm={async () => { if (!detail) return; const ok = await cancelAppointment(detail.id); if (ok) { toast('Consulta desmarcada — o registro fica no histórico.'); setDetail(null) } }}
        title="Desmarcar consulta" message={`Desmarcar a consulta de ${detail?.child ?? ''}? O horário fica livre e o registro continua no histórico (aparece em "Desmarcado").`} confirmLabel="Desmarcar" />

      <ConfirmDialog open={!!concluindo} onClose={() => setConcluindo(null)} onConfirm={() => { if (concluindo) void concluir(concluindo) }}
        title="Concluir atendimento"
        message={concluindo ? `Concluir ${concluindo.proc} de ${concluindo.child}? ${valorDe(concluindo) > 0 ? `Vai gerar a cobrança de ${fmtMoney(valorDe(concluindo))} e ` : 'Vai '}dar baixa nos materiais da ficha técnica. Isso acontece uma vez só por atendimento.` : ''}
        confirmLabel="Concluir" />
    </>
  )
}

/* ---------- Diária ---------- */
function DayView({ iso, cols, events, range, onPickDay, onOpen, onCreate, filtrado }: { iso: string; cols: { iso: string; d: string; n: string; today: boolean }[]; events: EventItem[]; range?: Range; onPickDay: (iso: string) => void; onOpen: (e: EventItem) => void; onCreate: (iso: string, hour: number) => void; filtrado: boolean }) {
  const [ghost, setGhost] = useState<number | null>(null)
  const noFundo = (e: React.MouseEvent<HTMLElement>) => e.target === e.currentTarget
  const dentroDoExpediente = (h: number) => !!range && h >= range.start && h < range.end
  const abriuNoFundo = useRef(false)
  const lanes = layoutLanes(events)
  return (
    <div>
      <div className="day-pills" role="group" aria-label="Dia da semana">
        {cols.map((c) => <button key={c.iso} aria-pressed={c.iso === iso} onClick={() => onPickDay(c.iso)}>{c.d.toLowerCase()} {c.n}{c.today ? ' · hoje' : ''}</button>)}
      </div>
      {events.length === 0 && (
        <p className="empty-note" style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="cal" size={15} /> {filtrado ? 'Nada neste filtro neste dia.' : 'Nenhum atendimento neste dia — clique em um horário para agendar.'}
        </p>
      )}
      <div className="day-board">
        <div className="time-col">{timeLabels.map((t) => <div key={t} className="time-label">{t}</div>)}</div>
        <div
          className={`day-col${range ? ' open' : ''}`}
          onMouseMove={(e) => {
            if (!range || !noFundo(e)) return setGhost(null)
            const h = slotAtPointer(e)
            setGhost(dentroDoExpediente(h) ? h : null)
          }}
          onMouseLeave={() => setGhost(null)}
          onMouseDown={(e) => { abriuNoFundo.current = noFundo(e) }}
          onClick={(e) => { if (!abriuNoFundo.current || !noFundo(e)) return; onCreate(iso, slotAtPointer(e)) }}
        >
          <OffHours range={range} />
          {ghost !== null && <NewSlotGhost hour={ghost} />}
          {events.map((e) => {
            const l = lanes[e.id] ?? { lane: 0, lanes: 1 }
            const w = 100 / l.lanes
            return (
              <div key={e.id} style={{ position: 'absolute', left: `calc(${l.lane * w}% + 8px)`, width: `calc(${w}% - 16px)`, top: (e.start - AGENDA_START) * AGENDA_ROW + 1, height: e.dur * AGENDA_ROW - 6 }}><EventCard e={e} onClick={() => onOpen(e)} /></div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ---------- Mensal ---------- */
function MonthView({ anchor, byDate, onPick }: { anchor: string; byDate: Record<string, EventItem[]>; onPick: (iso: string) => void }) {
  const ad = parseISO(anchor)
  const first = new Date(ad.getFullYear(), ad.getMonth(), 1)
  const startPad = (first.getDay() + 6) % 7 // segunda = 0
  const daysInMonth = new Date(ad.getFullYear(), ad.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(isoDate(new Date(ad.getFullYear(), ad.getMonth(), d)))
  const today = todayISO()
  return (
    <div className="month-grid">
      {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map((d) => <div key={d} className="month-wd">{d}</div>)}
      {cells.map((iso, i) => {
        if (!iso) return <div key={i} className="month-cell empty" aria-hidden="true" />
        // desmarcados não contam como atendimento do dia
        const doDia = (byDate[iso] ?? []).filter((e) => e.status !== 'desmarcado')
        const pendentes = doDia.filter((e) => e.status === 'agendado' && e.date >= today).length
        return (
          <button key={i} className={`month-cell${iso === today ? ' today' : ''}`} onClick={() => onPick(iso)}
            aria-label={`${parseISO(iso).getDate()}: ${doDia.length} atendimento${doDia.length === 1 ? '' : 's'}${pendentes ? `, ${pendentes} sem confirmação` : ''}`}>
            <span className="n">{parseISO(iso).getDate()}</span>
            {doDia.length > 0 && <span className="month-count">{doDia.length} atend.</span>}
            {pendentes > 0 && <span className="month-count alert">{pendentes} a confirmar</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Agenda no celular: faixa com os dias da semana e os atendimentos do dia em cartões. */
function AgendaCelular({ dia, onDia, eventos, contagem, onOpen, onConfirmar, onNovo }: {
  dia: string
  onDia: (iso: string) => void
  eventos: EventItem[]
  contagem: (iso: string) => number
  onOpen: (e: EventItem) => void
  onConfirmar: (e: EventItem) => void
  onNovo: () => void
}) {
  const hoje = todayISO()
  const segunda = mondayOf(parseISO(dia))
  const dias = weekColumns(segunda)
  return (
    <div className="ag-cel">
      <div className="ag-strip-row">
        <button className="nav-arrow" aria-label="Semana anterior" onClick={() => onDia(addDays(segunda, -7))}><Icon name="chevron" size={16} /></button>
        <div className="ag-strip" role="group" aria-label="Escolher dia">
          {dias.map((c) => {
            const n = contagem(c.iso)
            return (
              <button key={c.iso} aria-pressed={c.iso === dia} aria-label={`${longDate(c.iso)}${n ? `, ${n} atendimentos` : ''}`} onClick={() => onDia(c.iso)}>
                <span>{c.today ? 'hoje' : c.d.toLowerCase()}</span>
                <b>{c.n}</b>
                {n > 0 && <i aria-hidden="true" />}
              </button>
            )
          })}
        </div>
        <button className="nav-arrow" aria-label="Próxima semana" onClick={() => onDia(addDays(segunda, 7))}><span style={{ display: 'flex', transform: 'scaleX(-1)' }}><Icon name="chevron" size={16} /></span></button>
      </div>
      <p className="ag-dia">{longDate(dia)} · {eventos.length} {eventos.length === 1 ? 'atendimento' : 'atendimentos'}</p>

      {eventos.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center' }}>
          <p className="qempty" style={{ padding: '6px 0 12px' }}>Nenhum atendimento neste dia.</p>
          <button className="btn-cta sm" onClick={onNovo}><Icon name="plus" size={15} /> Agendar</button>
        </div>
      ) : eventos.map((e) => {
        const semConfirmacao = e.status === 'agendado' && e.date >= hoje
        const st = STATUS[e.status]
        return (
          <article key={e.id} className={`ag-card${e.status === 'em_atendimento' ? ' now' : ''}`}>
            <button className="ag-card-main" onClick={() => onOpen(e)}>
              <span className="ag-time">{fmtHour(e.start)}</span>
              <span className="ag-info">
                <b>{e.child}</b>
                <span>{[e.proc || 'Atendimento', e.age && e.age !== '—' ? e.age : ''].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
            <div className="ag-card-foot">
              <span className="st-chip" style={semConfirmacao ? { background: 'var(--red-bg)', color: 'var(--danger-text)' } : { background: st.bg, color: st.fg }}>{situacao(e)}</span>
              {semConfirmacao && <button className="btn-line" style={{ height: 34 }} onClick={() => onConfirmar(e)}><Icon name="wa" size={15} /> Confirmar</button>}
            </div>
          </article>
        )
      })}
    </div>
  )
}
