import { useMemo, useRef, useState } from 'react'
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Icon } from '../icons'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { Field, TextInput, Select, FieldRow } from '../components/Field'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { useOutsideClick } from '../components/useOutsideClick'
import { useStore, type EventItem, type Procedimento } from '../store'
import { dayRange, type Range } from '../lib/horarios'
import { useGoogle } from '../lib/GoogleProvider'
import { pushAppointment } from '../lib/googleCalendar'
import { mondayOf, addDays, todayISO, weekColumns, weekRangeLabel, longDate, isoDate, parseISO, brDate } from '../lib/dates'
import { waLink, findPatientByName, contactPhone, contactName } from '../lib/whats'
import { WaButton } from '../components/ui'
import { fmtDur, fmtMoney } from '../lib/fmt'
import { DateField } from '../components/DateField'
import { Butterfly } from './documents/DocKit'
import { STATUS, timeLabels, fmtHour, AGENDA_START, AGENDA_ROW, PERFIL, perfilToKind, type ApptStatus, type ApptKind, type Patient } from '../data'
import { PatientPhoto } from '../components/PatientPhoto'

const LEGEND: ApptStatus[] = ['agendado', 'confirmado', 'em_atendimento', 'concluido', 'faltou', 'desmarcado']
const VIEWS = ['Diária', 'Semanal', 'Mensal']
const snapHalf = (h: number) => Math.round(h * 2) / 2
/** Último horário da grade (as etiquetas cobrem AGENDA_START … AGENDA_START + n). */
const AGENDA_END = AGENDA_START + timeLabels.length

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
  if (kind === 'est') return <span title="Estético" style={{ display: 'inline-flex' }}><Butterfly size={13} color="#c2478a" /></span>
  if (kind === 'adt') return (
    <span title="Adulto" style={{ display: 'inline-flex' }}>
      <svg width="12" height="13" viewBox="0 0 24 24" fill="#0f766e"><circle cx="12" cy="7.5" r="3.6" /><path d="M4.5 20c0-4 3.6-6 7.5-6s7.5 2 7.5 6z" /></svg>
    </span>
  )
  return (
    <span title="Pediátrico" style={{ display: 'inline-flex' }}>
      <svg width="12" height="13" viewBox="0 0 24 24" fill="#3f6bf5"><path d="M12 3.4c-2.1-1.5-5-1.6-6.7.2-1.9 2-1.6 5.2-.8 8.2.5 1.9.8 3.4 1.1 5 .3 1.8 1.7 3.4 2.6 1.3.6-1.5.6-3.4 1.8-3.4s1.2 1.9 1.8 3.4c.9 2.1 2.3.5 2.6-1.3.3-1.6.6-3.1 1.1-5 .8-3 1.1-6.2-.8-8.2-1.7-1.8-4.6-1.7-6.7-.2z" /></svg>
    </span>
  )
}

/* ---------- busca de paciente ---------- */
function PatientPicker({ value, patients, onType, onPick }: { value: string; patients: Patient[]; onType: (v: string) => void; onPick: (p: Patient) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)
  const results = value.trim() ? patients.filter((p) => p.name.toLowerCase().includes(value.toLowerCase())).slice(0, 8) : patients.slice(0, 8)
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input className="field-input" value={value} placeholder="Buscar paciente cadastrado ou digitar novo…" onClick={() => setOpen(true)} onChange={(e) => { onType(e.target.value); setOpen(true) }} />
      {open && (
        <div className="menu-pop" style={{ left: 0, right: 0, width: 'auto', maxHeight: 240, overflow: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '9px 11px', font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Nenhum cadastrado — será um novo nome.</div>
          ) : results.map((p) => (
            <button key={p.name} className="menu-item" onClick={() => { onPick(p); setOpen(false) }}>
              <span className="avatar" style={{ width: 26, height: 26, font: "800 10px 'Plus Jakarta Sans'" }}>{p.initials}</span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{p.name}</span>
                <span style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8b93a7' }}>{p.age} · {PERFIL[p.perfil ?? 'pediatrico'].label}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- seletor de procedimento (dropdown estilizado) ---------- */
function ProcPicker({ value, procs, onType, onPick }: { value: string; procs: Procedimento[]; onType: (v: string) => void; onPick: (p: Procedimento) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)
  const results = value.trim() ? procs.filter((p) => p.proc.toLowerCase().includes(value.toLowerCase())) : procs
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input className="field-input" value={value} placeholder="Selecione ou digite" onClick={() => setOpen(true)} onChange={(e) => { onType(e.target.value); setOpen(true) }} />
      <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%) rotate(-90deg)', pointerEvents: 'none', color: '#8b93a7' }}><Icon name="chevron" size={16} /></span>
      {open && (
        <div className="menu-pop" style={{ left: 0, right: 0, width: 'auto', maxHeight: 240, overflow: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '9px 11px', font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Sem correspondência — será um novo procedimento.</div>
          ) : results.map((p) => (
            <button key={p.id} className="menu-item" onClick={() => { onPick(p); setOpen(false) }}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{p.proc}</span>
                <span style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8b93a7' }}>{p.cat} · {fmtDur(p.durMin)}</span>
              </span>
              <span className="tnum" style={{ font: "700 12px 'Plus Jakarta Sans'", color: '#26324a', flex: 'none' }}>{fmtMoney(p.val)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- evento arrastável + redimensionável ---------- */
function EventCard({ e, onClick, dragging, displayStart }: { e: EventItem; onClick?: () => void; dragging?: boolean; displayStart?: number }) {
  const st = STATUS[e.status]
  const time = displayStart ?? e.start
  const { patients } = useStore()
  const photo = findPatientByName(patients, e.child)?.photoUrl
  return (
    <div onClick={onClick} style={{ height: '100%', display: 'flex', gap: 7, alignItems: 'flex-start', background: st.bg, border: `1px solid ${st.border}`, borderLeft: `3px solid ${st.dot}`, borderRadius: 9, padding: '6px 9px', overflow: 'hidden', cursor: dragging ? 'grabbing' : 'pointer', boxShadow: dragging ? '0 14px 28px -10px rgba(38,60,110,.55)' : '0 1px 2px rgba(15,40,45,.05)' }}>
      {/* foto à esquerda, ocupando a altura das linhas de texto */}
      {photo && <PatientPhoto src={photo} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flex: 'none', marginTop: 2, boxShadow: '0 0 0 1.5px #fff' }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="tnum" style={dragging
            ? { font: "800 11px 'JetBrains Mono'", color: '#2f52e0', background: '#e0e8ff', padding: '1px 6px', borderRadius: 5, whiteSpace: 'nowrap' }
            : { font: "700 10px 'JetBrains Mono'", color: st.fg, whiteSpace: 'nowrap' }}>{fmtHour(time)} – {fmtHour(time + e.dur)}</span>
          <KindMark kind={e.kind} />
        </div>
        <div style={{ font: "800 12px 'Plus Jakarta Sans'", color: '#26324a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.child} <span style={{ fontWeight: 600, color: '#5b647a' }}>{e.age}</span></div>
        <div style={{ font: "600 10.5px 'Plus Jakarta Sans'", color: '#5b647a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.proc}</div>
      </div>
    </div>
  )
}

const HALF_ROW = AGENDA_ROW / 2 // 30 min

function DraggableEvent({ e, onOpen, onResize, lane = 0, lanes = 1, colW = 0, range }: { e: EventItem; onOpen: (e: EventItem) => void; onResize: (id: string, dur: number) => void; lane?: number; lanes?: number; colW?: number; range?: Range }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: e.id })
  const startResize = (down: React.PointerEvent) => {
    down.stopPropagation()
    down.preventDefault()
    const y0 = down.clientY
    const dur0 = e.dur
    const move = (m: PointerEvent) => {
      const next = Math.max(0.5, snapHalf(dur0 + (m.clientY - y0) / AGENDA_ROW))
      onResize(e.id, next)
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const w = 100 / lanes
  // Ajuste em blocos (Google Agenda): vertical trava em 30 min; horizontal trava por coluna (dia).
  const dyHours = transform ? (Math.round(transform.y / HALF_ROW) * HALF_ROW) / AGENDA_ROW : 0
  const lo = Math.max(AGENDA_START, range?.start ?? AGENDA_START)
  const hi = Math.min(18, range?.end ?? 18) - e.dur
  const liveStart = Math.max(lo, Math.min(Math.max(lo, hi), snapHalf(e.start + dyHours)))
  const sy = (liveStart - e.start) * AGENDA_ROW // card acompanha o horário travado, dentro do expediente
  const sx = transform ? (colW ? Math.round(transform.x / colW) * colW : transform.x) : 0
  return (
    <div ref={setNodeRef} style={{
      position: 'absolute', left: `calc(${lane * w}% + 4px)`, width: `calc(${w}% - 8px)`,
      top: (e.start - AGENDA_START) * AGENDA_ROW, height: e.dur * AGENDA_ROW - 6,
      transform: isDragging ? `translate3d(${sx}px, ${sy}px, 0)` : undefined,
      zIndex: isDragging ? 50 : 1, touchAction: 'none',
    }}>
      <div {...listeners} {...attributes} style={{ height: '100%' }}>
        <EventCard e={e} onClick={() => onOpen(e)} dragging={isDragging} displayStart={isDragging ? liveStart : undefined} />
      </div>
      <div onPointerDown={startResize} title="Arraste para mudar a duração" style={{ position: 'absolute', left: 0, right: 0, bottom: -3, height: 10, cursor: 'ns-resize' }}>
        <div style={{ width: 26, height: 3, borderRadius: 3, background: '#9aa6bd', margin: '4px auto 0' }} />
      </div>
    </div>
  )
}

/** Bloco de 30 min correspondente ao ponto clicado dentro da grade. */
function slotAtPointer(e: React.MouseEvent<HTMLElement>): number {
  const rect = e.currentTarget.getBoundingClientRect()
  return AGENDA_START + Math.floor((e.clientY - rect.top) / HALF_ROW) / 2
}

/** Faixa pontilhada que segue o cursor mostrando onde o agendamento cairia. */
function NewSlotGhost({ hour }: { hour: number }) {
  return (
    <div style={{
      position: 'absolute', left: 4, right: 4,
      top: (hour - AGENDA_START) * AGENDA_ROW, height: HALF_ROW - 3,
      border: '1.5px dashed #9db4fb', borderRadius: 8, background: 'rgba(63,107,245,0.07)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      font: "700 10.5px 'Plus Jakarta Sans'", color: '#2f52e0',
      pointerEvents: 'none', overflow: 'hidden', whiteSpace: 'nowrap',
    }}>
      + {fmtHour(hour)}
    </div>
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
  // fundo translúcido para que as linhas de hora (desenhadas na grade) apareçam em todas as colunas
  return (
    <div
      ref={setNodeRef}
      onMouseMove={(e) => {
        if (closed || !noFundo(e)) return setGhost(null)
        const h = slotAtPointer(e)
        setGhost(dentroDoExpediente(h) ? h : null)
      }}
      onMouseLeave={() => setGhost(null)}
      onMouseDown={(e) => { abriuNoFundo.current = noFundo(e) }}
      onClick={(e) => { if (!abriuNoFundo.current || !noFundo(e)) return; onCreate(iso, slotAtPointer(e)) }}
      style={{ position: 'relative', borderLeft: '1px solid #eff2f9', cursor: closed ? 'default' : 'copy', background: closed ? 'rgba(140,150,170,0.12)' : isOver ? 'rgba(63,107,245,0.10)' : today ? 'rgba(63,107,245,0.05)' : 'transparent', transition: 'background 0.15s ease' }}
    >
      {/* fora do expediente fica sombreado (como no Google Agenda) */}
      {range && range.start > AGENDA_START && <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: (range.start - AGENDA_START) * AGENDA_ROW, background: 'rgba(140,150,170,0.12)', pointerEvents: 'none' }} />}
      {range && range.end < 19 && <div style={{ position: 'absolute', left: 0, right: 0, top: (range.end - AGENDA_START) * AGENDA_ROW, bottom: 0, background: 'rgba(140,150,170,0.12)', pointerEvents: 'none' }} />}
      {closed && <div style={{ position: 'absolute', top: 10, left: 0, right: 0, textAlign: 'center', font: "700 10px 'Plus Jakarta Sans'", letterSpacing: '.08em', color: '#9aa4b6', pointerEvents: 'none' }}>FECHADO</div>}
      {ghost !== null && <NewSlotGhost hour={ghost} />}
      {children}
    </div>
  )
}

const EMPTY = (date: string) => ({ date, hour: '9', dur: '1', child: '', age: '', proc: '', status: 'agendado' as ApptStatus, kind: 'ped' as ApptKind })

export default function Agenda() {
  const [view, setView] = useState('Semanal')
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const { events, patients, procedimentos, horarios, addAppointment, updateAppointment, deleteAppointment, moveAppointment, baixaProcedimento, gerarCobranca } = useStore()
  const { toast } = useToast()
  const google = useGoogle()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY(todayISO()))
  const [detail, setDetail] = useState<EventItem | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [dayFocus, setDayFocus] = useState(todayISO())
  const gridRef = useRef<HTMLDivElement>(null)
  const [colW, setColW] = useState(0)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const cols = useMemo(() => weekColumns(weekStart), [weekStart])
  const byDate = useMemo(() => {
    const m: Record<string, EventItem[]> = {}
    events.forEach((e) => { (m[e.date] ??= []).push(e) })
    Object.values(m).forEach((l) => l.sort((a, b) => a.start - b.start))
    return m
  }, [events])
  // duração sugerida por procedimento (durMin numérico → horas, em blocos de 30 min)
  const procDur = useMemo(() => {
    const map: Record<string, number> = {}
    procedimentos.forEach((p) => { if (p.durMin) map[p.proc] = Math.max(0.5, snapHalf(p.durMin / 60)) })
    return map
  }, [procedimentos])

  // conflito: outro atendimento ativo no mesmo dia cujo intervalo sobrepõe o informado
  const conflictAt = (date: string, start: number, dur: number, excludeId?: string) =>
    events.find((e) => e.date === date && e.id !== excludeId && e.status !== 'desmarcado' && e.status !== 'faltou' && start < e.start + e.dur && e.start < start + dur)

  const openNew = (date?: string, hour?: number) => {
    const d = date ?? todayISO()
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

  const submit = () => {
    if (!form.child.trim()) return toast('Informe o paciente.', 'error')
    // respeita os horários de atendimento (Configurações)
    const range = dayRange(horarios, form.date)
    if (!range) return toast('A clínica não atende neste dia.', 'error')
    const start = Number(form.hour), dur = Number(form.dur)
    if (start < range.start || start + dur > range.end) return toast(`Fora do expediente (${fmtHour(range.start)} – ${fmtHour(range.end)}).`, 'error')
    setSaving(true)
    const date = form.date
    const ev = { start, dur, child: form.child.trim(), age: form.age.trim() || '—', proc: form.proc.trim() || 'Consulta', status: form.status, kind: form.kind }
    setTimeout(() => {
      addAppointment(date, ev)
      setSaving(false)
      setOpen(false)
      setWeekStart(mondayOf(parseISO(date)))
      const conf = conflictAt(date, ev.start, ev.dur)
      if (conf) toast(`Agendado — atenção: conflito com ${conf.child} às ${fmtHour(conf.start)}.`, 'error')
      else toast('Agendamento criado.')
      if (google.connected) pushAppointment({ date, ...ev }).then((id) => { if (id) toast('Evento criado no Google Calendar.', 'info') })
    }, 300)
  }

  const onDragStart = (_e: DragStartEvent) => {
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
    const hi = Math.max(lo, Math.min(18, range.end) - ev.dur)
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

  const setStatus = (s: ApptStatus) => {
    if (!detail) return
    const prev = detail.status
    updateAppointment(detail.id, { status: s })
    setDetail({ ...detail, status: s })
    // concluir o atendimento dá baixa no estoque e gera a cobrança do procedimento
    if (s === 'concluido' && prev !== 'concluido') {
      const parts: string[] = []
      const n = baixaProcedimento(detail.proc, detail.child)
      if (n > 0) parts.push(`${n} itens baixados do estoque`)
      const v = gerarCobranca(detail.proc, detail.child)
      if (v > 0) parts.push(`cobrança de ${fmtMoney(v)} gerada`)
      toast(parts.length ? `Atendimento concluído · ${parts.join(' · ')}.` : 'Atendimento concluído.')
      return
    }
    toast(`Status: ${STATUS[s].label}.`, 'info')
  }
  // edição direta de um agendamento existente (salva na hora, como o resto do app)
  const patchDetail = (p: Partial<EventItem>) => { if (!detail) return; updateAppointment(detail.id, p); setDetail({ ...detail, ...p }) }

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">Agenda</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="seg">{VIEWS.map((v) => <button key={v} className={`seg-item${v === view ? ' active' : ''}`} onClick={() => setView(v)}>{v}</button>)}</div>
          <Button icon={<Icon name="plus" size={17} />} onClick={() => openNew()}>Novo agendamento</Button>
        </div>
      </header>

      <div style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', borderBottom: '1px solid #eff2f9', background: '#fafbff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="icon-btn" style={{ width: 30, height: 30, borderRadius: 8, font: "700 15px 'Plus Jakarta Sans'" }} onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</button>
            <button className="icon-btn" style={{ width: 30, height: 30, borderRadius: 8, font: "700 15px 'Plus Jakarta Sans'" }} onClick={() => setWeekStart(addDays(weekStart, 7))}>›</button>
          </div>
          <span style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a' }}>{weekRangeLabel(weekStart)}</span>
          <button className="chip" onClick={() => { setWeekStart(mondayOf(new Date())); setDayFocus(todayISO()) }} style={{ font: "700 11.5px 'Plus Jakarta Sans'", color: '#2f52e0', background: '#e9eeff', padding: '4px 10px', borderRadius: 20 }}>Hoje</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {LEGEND.map((k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: STATUS[k].dot }} /><span style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#5b647a' }}>{STATUS[k].label}</span></div>
          ))}
        </div>
      </div>

      {view === 'Mensal' ? (
        <MonthView anchor={weekStart} counts={byDate} onPick={(iso) => { setDayFocus(iso); setWeekStart(mondayOf(parseISO(iso))); setView('Diária') }} />
      ) : view === 'Diária' ? (
        <DayView iso={dayFocus} cols={weekColumns(mondayOf(parseISO(dayFocus)))} events={byDate[dayFocus] ?? []} range={dayRange(horarios, dayFocus)} onPickDay={setDayFocus} onOpen={setDetail} onCreate={createAt} />
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 28px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(6, 1fr)', position: 'sticky', top: 0, background: '#f5f8fd', zIndex: 2, paddingTop: 10 }}>
            <div />
            {cols.map((c) => (
              <div key={c.iso} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '11px 0 10px', ...(c.today ? { background: '#e9eeff', borderRadius: '12px 12px 0 0' } : {}) }}>
                <span style={{ font: "700 10.5px 'Plus Jakarta Sans'", letterSpacing: '.05em', color: c.today ? '#2f52e0' : '#8b93a7' }}>{c.d}</span>
                <span style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', font: "800 14px 'Plus Jakarta Sans'", ...(c.today ? { background: '#3f6bf5', color: '#fff' } : { color: '#26324a' }) }}>{c.n}</span>
              </div>
            ))}
          </div>

          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: '60px repeat(6, 1fr)', border: '1px solid #eceff6', borderRadius: '0 0 12px 12px', overflow: 'hidden', background: '#fff', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 63px,#e7ecf4 63px,#e7ecf4 64px)' }}>
              <div style={{ position: 'relative', background: '#fafbff', borderRight: '1px solid #eceff6', zIndex: 1 }}>
                {timeLabels.map((t) => <div key={t} style={{ height: AGENDA_ROW, font: "600 10.5px 'JetBrains Mono'", color: '#8b93a7', textAlign: 'right', paddingRight: 10, transform: 'translateY(-7px)' }}>{t}</div>)}
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
      )}

      {/* Novo agendamento */}
      <Modal open={open} onClose={() => setOpen(false)} title="Novo agendamento" subtitle={longDate(form.date)} dirty={!!form.child.trim() || !!form.proc.trim()}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button loading={saving} onClick={submit}>Agendar</Button></>}>
        <Field label="Perfil do atendimento"><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ApptKind })}><option value="ped">Pediátrico</option><option value="est">Estético</option><option value="adt">Adulto</option></Select></Field>
        <Field label="Paciente">
          <PatientPicker value={form.child} patients={patients} onType={(v) => setForm({ ...form, child: v })} onPick={(p) => setForm({ ...form, child: p.name, age: p.age, kind: perfilToKind(p.perfil) })} />
        </Field>
        <FieldRow>
          <Field label="Idade"><TextInput value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="Ex.: 6a" /></Field>
          <Field label="Procedimento">
            <ProcPicker
              value={form.proc}
              procs={procedimentos}
              onType={(v) => setForm({ ...form, proc: v, dur: procDur[v] ? String(procDur[v]) : form.dur })}
              onPick={(p) => setForm({ ...form, proc: p.proc, dur: procDur[p.proc] ? String(procDur[p.proc]) : form.dur })}
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Data"><DateField value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} /></Field>
          <Field label="Horário"><Select value={form.hour} onChange={(e) => setForm({ ...form, hour: e.target.value })}><HourOptions range={dayRange(horarios, form.date)} /></Select></Field>
        </FieldRow>
        <FieldRow>
          <Field label="Duração"><Select value={form.dur} onChange={(e) => setForm({ ...form, dur: e.target.value })}><option value="0.5">30 min</option><option value="1">1 hora</option><option value="1.5">1h30</option><option value="2">2 horas</option></Select></Field>
          <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ApptStatus })}>{LEGEND.map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}</Select></Field>
        </FieldRow>
      </Modal>

      {/* Detalhe do evento */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.child ?? ''} subtitle={detail ? `${detail.proc} · ${longDate(detail.date)} · ${fmtHour(detail.start)}` : ''} width={420}
        footer={detail ? (<><Button variant="ghost" className="btn-danger" onClick={() => setConfirmDel(true)}>Cancelar consulta</Button><Button onClick={() => setDetail(null)}>Fechar</Button></>) : undefined}>
        {detail && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {LEGEND.map((s) => (
                <button key={s} className="chip" onClick={() => setStatus(s)} style={{ padding: '6px 11px', borderRadius: 20, font: "700 11px 'Plus Jakarta Sans'", border: `1px solid ${detail.status === s ? STATUS[s].border : '#eceff6'}`, background: detail.status === s ? STATUS[s].bg : '#fff', color: detail.status === s ? STATUS[s].fg : '#8b93a7' }}>{STATUS[s].label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <WaButton
                onClick={() => {
                  const p = findPatientByName(patients, detail.child)
                  const quem = contactName(p, detail.child)
                  const consulta = (detail.kind ?? 'ped') === 'ped' && p?.resp && p.resp !== '—' ? `a consulta de ${detail.child}` : 'sua consulta'
                  const msg = `Oi, ${quem}! 😊 Passando para confirmar ${consulta} com a Dra. Gabriela Lorenzi em ${brDate(detail.date)} às ${fmtHour(detail.start)} (${detail.proc || 'consulta'}). Responda SIM para confirmar ou REMARCAR se precisar mudar. 🦷`
                  const link = waLink(contactPhone(p), msg)
                  if (!link) return toast(`Sem telefone cadastrado para ${detail.child}. Complete o cadastro do paciente.`, 'error')
                  window.open(link, '_blank')
                }}
              >
                Enviar confirmação por WhatsApp
              </WaButton>
              <span style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8b93a7' }}>ao responder SIM, marque como Confirmado</span>
            </div>
            <Field label="Perfil do atendimento"><Select value={detail.kind ?? 'ped'} onChange={(e) => patchDetail({ kind: e.target.value as ApptKind })}><option value="ped">Pediátrico</option><option value="est">Estético</option><option value="adt">Adulto</option></Select></Field>
            <Field label="Paciente">
              <PatientPicker value={detail.child} patients={patients} onType={(v) => patchDetail({ child: v })} onPick={(p) => patchDetail({ child: p.name, age: p.age, kind: perfilToKind(p.perfil) })} />
            </Field>
            <FieldRow>
              <Field label="Idade"><TextInput value={detail.age} onChange={(e) => patchDetail({ age: e.target.value })} placeholder="Ex.: 6a" /></Field>
              <Field label="Procedimento">
                <ProcPicker value={detail.proc} procs={procedimentos} onType={(v) => patchDetail({ proc: v, dur: procDur[v] ?? detail.dur })} onPick={(p) => patchDetail({ proc: p.proc, dur: procDur[p.proc] ?? detail.dur })} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Data"><DateField value={detail.date} onChange={(iso) => { moveAppointment(detail.id, iso, detail.start); setDetail({ ...detail, date: iso }) }} /></Field>
              <Field label="Horário"><Select value={detail.start} onChange={(e) => patchDetail({ start: Number(e.target.value) })}><HourOptions range={dayRange(horarios, detail.date)} /></Select></Field>
            </FieldRow>
            <Field label="Duração"><Select value={String(detail.dur)} onChange={(e) => patchDetail({ dur: Number(e.target.value) })}><option value="0.5">30 min</option><option value="1">1 hora</option><option value="1.5">1h30</option><option value="2">2 horas</option></Select></Field>
          </>
        )}
      </Modal>

      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={() => { if (detail) { deleteAppointment(detail.id); toast('Consulta cancelada.'); setDetail(null) } }}
        title="Cancelar consulta" message={`Deseja cancelar a consulta de ${detail?.child ?? ''}?`} confirmLabel="Cancelar consulta" />
    </>
  )
}

/* ---------- Diária ---------- */
function DayView({ iso, cols, events, range, onPickDay, onOpen, onCreate }: { iso: string; cols: { iso: string; d: string; n: string; today: boolean }[]; events: EventItem[]; range?: Range; onPickDay: (iso: string) => void; onOpen: (e: EventItem) => void; onCreate: (iso: string, hour: number) => void }) {
  const [ghost, setGhost] = useState<number | null>(null)
  const noFundo = (e: React.MouseEvent<HTMLElement>) => e.target === e.currentTarget
  const dentroDoExpediente = (h: number) => !!range && h >= range.start && h < range.end
  const abriuNoFundo = useRef(false)
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px 28px 24px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {cols.map((c) => <button key={c.iso} className={`seg-item${c.iso === iso ? ' active' : ''}`} onClick={() => onPickDay(c.iso)} style={{ borderRadius: 10, border: '1px solid #eceff6' }}>{c.d} {c.n}</button>)}
      </div>
      {events.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>
          <Icon name="cal" size={15} /> Nenhum atendimento neste dia — clique em um horário para agendar.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', border: '1px solid #eceff6', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
        <div style={{ position: 'relative', background: '#fafbff', borderRight: '1px solid #eceff6' }}>{timeLabels.map((t) => <div key={t} style={{ height: AGENDA_ROW, font: "600 10.5px 'JetBrains Mono'", color: '#8b93a7', textAlign: 'right', paddingRight: 10, transform: 'translateY(-7px)' }}>{t}</div>)}</div>
        <div
          onMouseMove={(e) => {
            if (!range || !noFundo(e)) return setGhost(null)
            const h = slotAtPointer(e)
            setGhost(dentroDoExpediente(h) ? h : null)
          }}
          onMouseLeave={() => setGhost(null)}
          onMouseDown={(e) => { abriuNoFundo.current = noFundo(e) }}
          onClick={(e) => { if (!abriuNoFundo.current || !noFundo(e)) return; onCreate(iso, slotAtPointer(e)) }}
          style={{ position: 'relative', cursor: range ? 'copy' : 'default', backgroundImage: 'repeating-linear-gradient(to bottom,transparent 0,transparent 63px,#eff2f9 63px,#eff2f9 64px)' }}
        >
          {!range && <div style={{ position: 'absolute', inset: 0, background: 'rgba(140,150,170,0.12)', pointerEvents: 'none' }} />}
          {range && range.start > AGENDA_START && <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: (range.start - AGENDA_START) * AGENDA_ROW, background: 'rgba(140,150,170,0.12)', pointerEvents: 'none' }} />}
          {range && range.end < 19 && <div style={{ position: 'absolute', left: 0, right: 0, top: (range.end - AGENDA_START) * AGENDA_ROW, bottom: 0, background: 'rgba(140,150,170,0.12)', pointerEvents: 'none' }} />}
          {ghost !== null && <NewSlotGhost hour={ghost} />}
          {(() => {
            const lanes = layoutLanes(events)
            return events.map((e) => {
              const l = lanes[e.id] ?? { lane: 0, lanes: 1 }
              const w = 100 / l.lanes
              return (
                <div key={e.id} style={{ position: 'absolute', left: `calc(${l.lane * w}% + 8px)`, width: `calc(${w}% - 16px)`, top: (e.start - AGENDA_START) * AGENDA_ROW, height: e.dur * AGENDA_ROW - 6 }}><EventCard e={e} onClick={() => onOpen(e)} /></div>
              )
            })
          })()}
        </div>
      </div>
    </div>
  )
}

/* ---------- Mensal ---------- */
function MonthView({ anchor, counts, onPick }: { anchor: string; counts: Record<string, EventItem[]>; onPick: (iso: string) => void }) {
  const ad = parseISO(anchor)
  const first = new Date(ad.getFullYear(), ad.getMonth(), 1)
  const startPad = (first.getDay() + 6) % 7 // segunda = 0
  const daysInMonth = new Date(ad.getFullYear(), ad.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(isoDate(new Date(ad.getFullYear(), ad.getMonth(), d)))
  const today = todayISO()
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '18px 28px 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map((d) => <div key={d} style={{ textAlign: 'center', font: "700 10px 'JetBrains Mono'", color: '#8b93a7', padding: '4px 0' }}>{d}</div>)}
        {cells.map((iso, i) => {
          const c = iso ? (counts[iso]?.length ?? 0) : 0
          return (
            <button key={i} className="card card-hover" disabled={!iso} onClick={() => iso && onPick(iso)} style={{ minHeight: 78, padding: 8, textAlign: 'left', border: '1px solid #eceff6', background: iso ? '#fff' : 'transparent', cursor: iso ? 'pointer' : 'default', opacity: iso ? 1 : 0.4 }}>
              {iso && <div style={{ font: "700 12px 'Plus Jakarta Sans'", color: iso === today ? '#3f6bf5' : '#26324a' }}>{parseISO(iso).getDate()}</div>}
              {c > 0 && <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, font: "700 10px 'Plus Jakarta Sans'", color: '#2f52e0', background: '#e9eeff', padding: '2px 7px', borderRadius: 12 }}>{c} atend.</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
