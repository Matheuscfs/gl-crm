import { useEffect, useMemo, useState } from 'react'
import { DndContext, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Icon } from '../../icons'
import { SectionTitle, WaButton } from '../../components/ui'
import { Menu } from '../../components/Menu'
import { useToast } from '../../components/Toast'
import { useStore, type EventItem } from '../../store'
import { supabase } from '../../lib/supabase'
import { todayISO, addDays, parseISO, brDate } from '../../lib/dates'
import { findPatientByName, contactPhone, waLink } from '../../lib/whats'
import type { Patient } from '../../data'
import { retornoVencido } from '../../lib/retornos'

/**
 * CRC · Central de Relacionamento (padrão Clinicorp): filas de oportunidades
 * geradas automaticamente dos dados — retornos vencidos, faltas recentes,
 * aniversariantes e manutenções estéticas — organizadas por status de contato.
 */

export type CrcTipo = 'retorno' | 'falta' | 'aniversario' | 'estetica'

export interface CrcOpp {
  key: string
  tipo: CrcTipo
  name: string
  resp: string
  sub: string
  phone: string
  msg: string
}

const TIPOS: Record<CrcTipo, { label: string; bg: string; fg: string }> = {
  retorno: { label: 'Retorno', bg: 'var(--primary-bg)', fg: 'var(--primary-dark)' },
  falta: { label: 'Falta', bg: 'var(--red-bg)', fg: 'var(--danger-text)' },
  aniversario: { label: 'Aniversário', bg: 'var(--amber-bg)', fg: 'var(--amber-dark)' },
  estetica: { label: 'Estética', bg: 'var(--brand-pink-bg)', fg: 'var(--brand-pink)' },
}

const CRC_STAGES = ['A contatar', 'Contatado', 'Agendado', 'Recuperado']
const STORAGE_KEY = 'gl-crc-status'
const WD_ABBR = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function readStatusMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function deriveOpps(patients: Patient[], events: EventItem[]): CrcOpp[] {
  const today = todayISO()
  const opps: CrcOpp[] = []

  // Retornos vencidos
  for (const p of patients) {
    if (!retornoVencido(p, today)) continue
    const quem = p.resp !== '—' && p.resp ? p.resp.split('·')[0].trim() : p.name
    opps.push({
      key: `ret:${p.name}`,
      tipo: 'retorno',
      name: p.name,
      resp: p.resp !== '—' ? p.resp : '',
      sub: p.next && p.next !== '—' ? p.next : 'retorno vencido',
      phone: contactPhone(p),
      msg: `Oi, ${quem}! 😊 Sentimos falta por aqui — o retorno de ${p.name} está vencido. Vamos agendar uma consulta com a Dra. Gabriela? 🦷`,
    })
  }

  // Faltas dos últimos 30 dias (uma por paciente, a mais recente)
  const since = addDays(today, -30)
  const faltas = new Map<string, EventItem>()
  for (const e of events) {
    if (e.status !== 'faltou' || e.date < since || e.date > today) continue
    const cur = faltas.get(e.child)
    if (!cur || e.date > cur.date) faltas.set(e.child, e)
  }
  for (const e of faltas.values()) {
    const p = findPatientByName(patients, e.child)
    const quem = p && p.resp !== '—' && p.resp ? p.resp.split('·')[0].trim() : e.child
    opps.push({
      key: `falta:${e.child}:${e.date}`,
      tipo: 'falta',
      name: p?.name ?? e.child,
      resp: p && p.resp !== '—' ? p.resp : '',
      sub: `faltou em ${brDate(e.date)}${e.proc ? ` · ${e.proc}` : ''}`,
      phone: contactPhone(p),
      msg: `Oi, ${quem}! Notamos que não deu para vir à consulta do dia ${brDate(e.date)}. Vamos remarcar em um horário melhor? 😊`,
    })
  }

  // Aniversariantes dos próximos 7 dias
  for (const p of patients) {
    if (!p.birthdate) continue
    const b = parseISO(p.birthdate)
    if (Number.isNaN(b.getTime())) continue
    for (let i = 0; i < 7; i++) {
      const d = parseISO(addDays(today, i))
      if (d.getDate() !== b.getDate() || d.getMonth() !== b.getMonth()) continue
      const turns = d.getFullYear() - b.getFullYear()
      const when = i === 0 ? 'hoje' : `${WD_ABBR[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
      const quem = p.resp !== '—' && p.resp ? p.resp.split('·')[0].trim() : p.name
      opps.push({
        key: `nive:${p.name}:${d.getFullYear()}`,
        tipo: 'aniversario',
        name: p.name,
        resp: p.resp !== '—' ? p.resp : '',
        sub: `completa ${turns} ano${turns === 1 ? '' : 's'} · ${when}`,
        phone: contactPhone(p),
        msg: `🎉 Oi, ${quem}! A equipe da Dra. Gabriela Lorenzi deseja um feliz aniversário para ${p.name}! Muita saúde e muitos sorrisos! 🥳🦷`,
      })
      break
    }
  }

  // Manutenções / retoques estéticos
  for (const p of patients) {
    if (p.perfil !== 'estetico' || !p.last || p.last === '—') continue
    opps.push({
      key: `est:${p.name}`,
      tipo: 'estetica',
      name: p.name,
      resp: '',
      sub: `${p.status === 'manutencao' ? 'manutenção / retoque' : 'reavaliação estética'} · última visita ${p.last}`,
      phone: contactPhone(p),
      msg: `Oi, ${p.name}! ✨ Já faz um tempinho desde seu último procedimento. Que tal agendar uma reavaliação com a Dra. Gabriela para manter o resultado em dia?`,
    })
  }

  return opps
}

interface CardProps {
  o: CrcOpp
  stage: number
  onWa: (o: CrcOpp) => void
  onMove: (key: string, to: number) => void
  dragging?: boolean
}

function CrcCardView({ o, stage, onWa, onMove, dragging }: CardProps) {
  const t = TIPOS[o.tipo]
  return (
    <div className="card-hover" style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 11, padding: '11px 12px', marginBottom: 8, boxShadow: dragging ? '0 12px 24px -10px rgba(38,60,110,.5)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ font: "700 9.5px var(--font)", color: t.fg, background: t.bg, padding: '2px 7px', borderRadius: 20 }}>{t.label}</span>
          </div>
          <div style={{ font: "700 12.5px var(--font)", color: 'var(--ink)' }}>{o.name}</div>
          {o.resp && <div style={{ font: "600 11px var(--font)", color: 'var(--muted)', marginTop: 2 }}>{o.resp}</div>}
          <div style={{ font: "600 11px var(--font)", color: 'var(--slate)', margin: '3px 0 8px' }}>{o.sub}</div>
          <WaButton onClick={() => onWa(o)}>WhatsApp</WaButton>
        </div>
        <Menu
          items={[
            { label: 'Abrir WhatsApp', onClick: () => onWa(o) },
            ...(stage > 0 ? [{ label: '← Etapa anterior', onClick: () => onMove(o.key, stage - 1) }] : []),
            ...(stage < CRC_STAGES.length - 1 ? [{ label: 'Próxima etapa →', onClick: () => onMove(o.key, stage + 1) }] : []),
            ...(stage < CRC_STAGES.length - 1 ? [{ label: 'Marcar recuperado', onClick: () => onMove(o.key, CRC_STAGES.length - 1) }] : []),
          ]}
        />
      </div>
    </div>
  )
}

function DraggableCrcCard(props: CardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.o.key })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <CrcCardView {...props} />
    </div>
  )
}

function CrcColumn({ index, count, children }: { index: number; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `crc-${index}` })
  const done = index === CRC_STAGES.length - 1
  return (
    <div ref={setNodeRef} style={{ width: 230, flex: 'none', background: isOver ? 'var(--primary-bg)' : 'var(--chip-bg)', borderRadius: 14, padding: '10px 10px 12px', transition: 'background 0.15s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 10px' }}>
        <span style={{ font: "700 11.5px var(--font)", color: 'var(--slate)' }}>{CRC_STAGES[index]}</span>
        <span style={{ minWidth: 22, height: 20, padding: '0 6px', borderRadius: 20, background: 'var(--surface)', color: done ? 'var(--green-dark)' : 'var(--primary-dark)', font: "800 11px var(--font)", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
      </div>
      {children}
    </div>
  )
}

export default function CrcBoard() {
  const { patients, events } = useStore()
  const { toast } = useToast()
  const [statusMap, setStatusMap] = useState<Record<string, number>>(readStatusMap)
  const [filtro, setFiltro] = useState<'todas' | CrcTipo>('todas')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const opps = useMemo(() => deriveOpps(patients, events), [patients, events])

  useEffect(() => {
    const sb = supabase
    if (!sb) return
    let cancelled = false
    sb.from('crc_status').select('opp_key,stage').then(({ data, error }) => {
      if (cancelled || error || !data?.length) return
      setStatusMap((prev) => {
        const next = { ...prev }
        data.forEach((r) => { next[r.opp_key as string] = Number(r.stage) || 0 })
        return next
      })
    })
    return () => { cancelled = true }
  }, [])

  const move = (key: string, to: number) => {
    setStatusMap((prev) => {
      const next = { ...prev, [key]: to }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
    toast(`Movido para "${CRC_STAGES[to]}".`)
    if (supabase) supabase.from('crc_status').upsert({ opp_key: key, stage: to }, { onConflict: 'opp_key' }).then(({ error }) => { if (error) console.error('[supabase] crc_status', error.message) })
  }

  const openWa = (o: CrcOpp) => {
    const link = waLink(o.phone, o.msg)
    if (!link) return toast(`Sem telefone cadastrado para ${o.name}.`, 'error')
    window.open(link, '_blank')
    if ((statusMap[o.key] ?? 0) === 0) move(o.key, 1)
  }

  const visible = filtro === 'todas' ? opps : opps.filter((o) => o.tipo === filtro)
  const cols = CRC_STAGES.map((_, i) => visible.filter((o) => (statusMap[o.key] ?? 0) === i))
  const abertas = opps.filter((o) => (statusMap[o.key] ?? 0) < CRC_STAGES.length - 1).length
  const activeOpp = activeKey ? opps.find((o) => o.key === activeKey) ?? null : null

  const onDragStart = (e: DragStartEvent) => setActiveKey(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setActiveKey(null)
    if (!e.over) return
    const to = Number(String(e.over.id).replace('crc-', ''))
    const key = String(e.active.id)
    if ((statusMap[key] ?? 0) !== to) move(key, to)
  }

  const contadores: { id: 'todas' | CrcTipo; label: string }[] = [
    { id: 'todas', label: `Todas (${opps.length})` },
    { id: 'retorno', label: `Retornos (${opps.filter((o) => o.tipo === 'retorno').length})` },
    { id: 'falta', label: `Faltas (${opps.filter((o) => o.tipo === 'falta').length})` },
    { id: 'aniversario', label: `Aniversários (${opps.filter((o) => o.tipo === 'aniversario').length})` },
    { id: 'estetica', label: `Estética (${opps.filter((o) => o.tipo === 'estetica').length})` },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <SectionTitle>
          CRC · Central de Relacionamento{' '}
          <span style={{ font: "600 11.5px var(--font)", color: 'var(--muted)' }}>
            · {abertas} oportunidade{abertas === 1 ? '' : 's'} em aberto, geradas dos seus dados
          </span>
        </SectionTitle>
        <div className="seg">
          {contadores.map((c) => (
            <button key={c.id} className={`seg-item${filtro === c.id ? ' active' : ''}`} onClick={() => setFiltro(c.id)}>{c.label}</button>
          ))}
        </div>
      </div>

      {opps.length === 0 ? (
        <div className="card" style={{ padding: '22px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="chat" size={18} />
          <span style={{ font: "600 12.5px var(--font)", color: 'var(--slate)' }}>
            Nenhuma oportunidade no momento — sem retornos vencidos, faltas recentes ou aniversários na semana. 🎉
          </span>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
            {cols.map((col, i) => (
              <CrcColumn key={CRC_STAGES[i]} index={i} count={col.length}>
                {col.map((o) => (
                  <DraggableCrcCard key={o.key} o={o} stage={i} onWa={openWa} onMove={move} />
                ))}
                {col.length === 0 && (
                  <div style={{ font: "600 11px var(--font)", color: 'var(--muted)', textAlign: 'center', padding: '14px 0' }}>Solte um card aqui</div>
                )}
              </CrcColumn>
            ))}
          </div>
          <DragOverlay>{activeOpp ? <div style={{ width: 210 }}><CrcCardView o={activeOpp} stage={0} onWa={() => {}} onMove={() => {}} dragging /></div> : null}</DragOverlay>
        </DndContext>
      )}
    </div>
  )
}
