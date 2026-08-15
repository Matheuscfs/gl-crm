import { useState } from 'react'
import { DndContext, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Icon } from '../icons'
import { SectionTitle } from '../components/ui'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { Field, TextInput, Select, Textarea } from '../components/Field'
import { Menu } from '../components/Menu'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'
import { useStore, type LeadCard } from '../store'
import { supabase } from '../lib/supabase'
import { reguaPediatrico, reguaEstetico, reguaAdulto, ORIGENS } from '../data'
import { useEffect } from 'react'
import CrcBoard from './crm/CrcBoard'

const EMPTY_LEAD = { name: '', resp: '', info: '', origem: 'Indicação' }
const DEFAULT_MSG =
  'Oi, {responsavel}! 😊 Passando para lembrar da consulta de {crianca} com a Dra. Gabriela Lorenzi. Responda SIM para confirmar ou REMARCAR se precisar mudar. 🦷'

interface LeadViewProps {
  c: LeadCard
  stageIndex: number
  onOpen: (c: LeadCard) => void
  onMove: (id: string, to: number) => void
  onDelete: (c: LeadCard) => void
  dragging?: boolean
}

function LeadCardView({ c, stageIndex, onOpen, onMove, onDelete, dragging }: LeadViewProps) {
  return (
    <div className="card-hover" style={{ background: '#fff', border: '1px solid #eceff6', borderRadius: 11, padding: '11px 12px', marginBottom: 8, boxShadow: dragging ? '0 12px 24px -10px rgba(38,60,110,.5)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div onClick={() => onOpen(c)} style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}>
          <div style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{c.name}</div>
          <div style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8b93a7', margin: '2px 0 6px' }}>{c.resp}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {c.origem && <span style={{ font: "700 10px 'Plus Jakarta Sans'", color: '#2f52e0', background: '#e9eeff', padding: '3px 8px', borderRadius: 20 }}>{c.origem}</span>}
            {c.info && <span style={{ font: "700 10px 'Plus Jakarta Sans'", color: '#5b647a', background: '#eef2f9', padding: '3px 8px', borderRadius: 20 }}>{c.info}</span>}
          </div>
        </div>
        <Menu
          items={[
            { label: 'Abrir', onClick: () => onOpen(c) },
            ...(stageIndex > 0 ? [{ label: '← Etapa anterior', onClick: () => onMove(c.id, stageIndex - 1) }] : []),
            { label: 'Excluir', danger: true, onClick: () => onDelete(c) },
          ]}
        />
      </div>
    </div>
  )
}

function DraggableLead(props: LeadViewProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.c.id })
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <LeadCardView {...props} />
    </div>
  )
}

function StageColumn({ index, stage, count, children }: { index: number; stage: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage-${index}` })
  return (
    <div ref={setNodeRef} style={{ width: 210, flex: 'none', background: isOver ? '#e9eeff' : '#eef2f9', borderRadius: 14, padding: '10px 10px 12px', transition: 'background 0.15s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 10px' }}>
        <span style={{ font: "700 11.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>{stage}</span>
        <span style={{ minWidth: 22, height: 20, padding: '0 6px', borderRadius: 20, background: '#fff', color: '#2f52e0', font: "800 11px 'Plus Jakarta Sans'", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
      </div>
      {children}
    </div>
  )
}

export default function CRM() {
  const { funil, addLead, updateLead, deleteLead, moveLead } = useStore()
  const { toast } = useToast()
  const [reguaPerfil, setReguaPerfil] = useState<'pediatrico' | 'estetico' | 'adulto'>('pediatrico')
  const [reguaPed, setReguaPed] = useState(reguaPediatrico)
  const [reguaEst, setReguaEst] = useState(reguaEstetico)
  const [reguaAdt, setReguaAdt] = useState(reguaAdulto)
  const regua = reguaPerfil === 'pediatrico' ? reguaPed : reguaPerfil === 'estetico' ? reguaEst : reguaAdt
  const setRegua = reguaPerfil === 'pediatrico' ? setReguaPed : reguaPerfil === 'estetico' ? setReguaEst : setReguaAdt
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_LEAD)
  const [edit, setEdit] = useState<LeadCard | null>(null)
  const [editStage, setEditStage] = useState(0)
  const [confirmLead, setConfirmLead] = useState<LeadCard | null>(null)
  const [msg, setMsg] = useState<{ id: string; title: string; when: string } | null>(null)
  const [msgText, setMsgText] = useState('')
  const [templates, setTemplates] = useState<Record<string, string>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const stages = funil.map((c) => c.stage)
  const activeCard = activeId ? funil.flatMap((c) => c.cards).find((c) => c.id === activeId) ?? null : null

  useEffect(() => {
    const sb = supabase
    if (!sb) return
    let cancelled = false
    sb.from('regua_rules').select('rule_id,is_on,body').then(({ data, error }) => {
      if (cancelled || error || !data?.length) return
      const m = new Map(data.map((r) => [r.rule_id as string, !!r.is_on]))
      setReguaPed((prev) => prev.map((r) => (m.has(r.id) ? { ...r, on: m.get(r.id)! } : r)))
      setReguaEst((prev) => prev.map((r) => (m.has(r.id) ? { ...r, on: m.get(r.id)! } : r)))
      setReguaAdt((prev) => prev.map((r) => (m.has(r.id) ? { ...r, on: m.get(r.id)! } : r)))
      // mensagens editadas persistidas (coluna body)
      const bodies: Record<string, string> = {}
      data.forEach((r) => { if (r.body) bodies[r.rule_id as string] = r.body as string })
      if (Object.keys(bodies).length) setTemplates((prev) => ({ ...bodies, ...prev }))
    })
    return () => { cancelled = true }
  }, [])

  const toggle = (id: string) => {
    const cur = regua.find((r) => r.id === id)
    if (!cur) return
    const on = !cur.on
    setRegua((prev) => prev.map((r) => (r.id === id ? { ...r, on } : r)))
    toast(`${cur.title} ${on ? 'ativada' : 'desativada'}.`, 'info')
    if (supabase) supabase.from('regua_rules').upsert({ rule_id: id, title: cur.title, whn: cur.when, is_on: on, perfil: reguaPerfil }, { onConflict: 'rule_id' }).then(({ error }) => { if (error) console.error('[supabase] regua', error.message) })
  }

  const submitLead = () => {
    if (!form.name.trim()) return toast('Informe o nome do lead.', 'error')
    setSaving(true)
    setTimeout(() => {
      addLead(form.name.trim(), form.resp.trim() || '—', form.info.trim() || 'novo contato', form.origem)
      setSaving(false)
      setOpen(false)
      setForm(EMPTY_LEAD)
      toast('Lead adicionado ao funil.')
    }, 400)
  }

  const openLead = (c: LeadCard) => {
    setEdit(c)
    setEditStage(funil.findIndex((col) => col.cards.some((x) => x.id === c.id)))
  }
  const saveLead = () => {
    if (!edit) return
    updateLead(edit.id, { name: edit.name, resp: edit.resp, info: edit.info, origem: edit.origem })
    const curStage = funil.findIndex((col) => col.cards.some((x) => x.id === edit.id))
    if (curStage !== editStage) moveLead(edit.id, editStage)
    setEdit(null)
    toast('Lead atualizado.')
  }

  const openMsg = (id: string, title: string, when: string) => {
    setMsg({ id, title, when })
    setMsgText(templates[id] ?? DEFAULT_MSG)
  }
  const saveMsg = () => {
    if (!msg) return
    setTemplates((t) => ({ ...t, [msg.id]: msgText }))
    if (supabase) supabase.from('regua_rules').upsert({ rule_id: msg.id, title: msg.title, whn: msg.when, body: msgText }, { onConflict: 'rule_id' }).then(({ error }) => { if (error) console.error('[supabase] regua body', error.message) })
    setMsg(null)
    toast('Modelo de mensagem salvo.')
  }

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    if (!e.over) return
    const to = Number(String(e.over.id).replace('stage-', ''))
    const from = funil.findIndex((col) => col.cards.some((c) => c.id === e.active.id))
    if (from !== to) {
      moveLead(String(e.active.id), to)
      toast(`Movido para "${stages[to]}".`)
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">Relacionamento</div>
        <Button icon={<Icon name="plus" size={17} />} onClick={() => setOpen(true)}>Novo lead</Button>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <CrcBoard />

        <div>
          <SectionTitle>Funil de leads <span style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#8b93a7' }}>· arraste os cards entre etapas</span></SectionTitle>
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6 }}>
              {funil.map((col, i) => (
                <StageColumn key={col.stage} index={i} stage={col.stage} count={col.cards.length}>
                  {col.cards.map((c) => (
                    <DraggableLead key={c.id} c={c} stageIndex={i} onOpen={openLead} onMove={moveLead} onDelete={setConfirmLead} />
                  ))}
                  {col.cards.length === 0 && (
                    <div style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#aeb7c8', textAlign: 'center', padding: '14px 0' }}>Solte um card aqui</div>
                  )}
                </StageColumn>
              ))}
            </div>
            <DragOverlay>{activeCard ? <div style={{ width: 190 }}><LeadCardView c={activeCard} stageIndex={0} onOpen={() => {}} onMove={() => {}} onDelete={() => {}} dragging /></div> : null}</DragOverlay>
          </DndContext>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 22 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <SectionTitle>Régua de comunicação</SectionTitle>
              <div className="seg">
                <button className={`seg-item${reguaPerfil === 'pediatrico' ? ' active' : ''}`} onClick={() => setReguaPerfil('pediatrico')}>Pediátrico</button>
                <button className={`seg-item${reguaPerfil === 'estetico' ? ' active' : ''}`} onClick={() => setReguaPerfil('estetico')}>Estético</button>
                <button className={`seg-item${reguaPerfil === 'adulto' ? ' active' : ''}`} onClick={() => setReguaPerfil('adulto')}>Adulto</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {regua.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 12, border: `1px solid ${r.on ? '#cdd8ff' : '#eceff6'}`, background: r.on ? '#eef2ff' : '#fff' }}>
                  <button className={`switch${r.on ? ' on' : ''}`} onClick={() => toggle(r.id)} aria-pressed={r.on}><span className="switch-knob" /></button>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: "700 13px 'Plus Jakarta Sans'", color: '#26324a' }}>{r.title}</div>
                    <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Dispara {r.when}</div>
                  </div>
                  <button className="chip" onClick={() => openMsg(r.id, r.title, r.when)} style={{ background: 'transparent', font: "700 11.5px 'Plus Jakarta Sans'", color: '#2f52e0', padding: '4px 6px', borderRadius: 8 }}>Editar mensagem</button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle>Preview · WhatsApp</SectionTitle>
            <div style={{ border: '1px solid #d7ddea', borderRadius: 22, overflow: 'hidden', background: '#e7ded6', boxShadow: '0 10px 30px -12px rgba(38,60,110,.3)' }}>
              <div style={{ background: '#3f6bf5', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fff', color: '#c2478a', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "italic 800 14px Georgia, serif" }}>GL</div>
                <div>
                  <div style={{ font: "800 13.5px 'Plus Jakarta Sans'", color: '#fff' }}>Gabriela Lorenzi</div>
                  <div style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#d7e0ff' }}>Cirurgiã Dentista</div>
                </div>
              </div>
              <div style={{ padding: '18px 14px', minHeight: 280, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 10 }}>
                <div style={{ alignSelf: 'center', background: '#fff', color: '#5b647a', font: "700 10px 'Plus Jakarta Sans'", padding: '4px 11px', borderRadius: 8 }}>Lembrete 48h antes</div>
                <div style={{ alignSelf: 'flex-end', maxWidth: '82%', background: '#d9f2ec', borderRadius: '14px 14px 4px 14px', padding: '10px 13px', boxShadow: '0 1px 1px rgba(0,0,0,.06)' }}>
                  <div style={{ font: "500 12.5px/1.5 'Plus Jakarta Sans'", color: '#26324a' }}>
                    Oi, Ana Paula! 😊 Passando para lembrar que a <b>Sofia</b> tem consulta com a Dra. Gabriela Lorenzi <b>amanhã, 19/07 (sex) às 09:00</b>. Podemos confirmar? Responda <b>SIM</b> para confirmar ou <b>REMARCAR</b> se precisar mudar. 🦷
                  </div>
                  <div style={{ textAlign: 'right', font: "600 10px 'Plus Jakarta Sans'", color: '#7fb8ac', marginTop: 4 }}>08:32 ✓✓</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Novo lead */}
      <Modal open={open} onClose={() => setOpen(false)} title="Novo lead" subtitle="Entra no topo do funil (Contato)" dirty={!!(form.name.trim() || form.resp.trim() || form.info.trim())}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button loading={saving} onClick={submitLead}>Adicionar lead</Button></>}>
        <Field label="Nome da criança"><TextInput autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Enzo Lima" /></Field>
        <Field label="Responsável"><TextInput value={form.resp} onChange={(e) => setForm({ ...form, resp: e.target.value })} placeholder="Ex.: Paula · mãe" /></Field>
        <Field label="Origem"><Select value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })}>{ORIGENS.map((o) => <option key={o} value={o}>{o}</option>)}</Select></Field>
        <Field label="Observação"><TextInput value={form.info} onChange={(e) => setForm({ ...form, info: e.target.value })} placeholder="Ex.: pediu orçamento de aparelho" /></Field>
      </Modal>

      {/* Editar lead */}
      <Modal open={!!edit} onClose={() => setEdit(null)} title="Editar lead" width={420}
        footer={<><Button variant="ghost" className="btn-danger" onClick={() => { if (edit) { setConfirmLead(edit); setEdit(null) } }}>Excluir</Button><Button onClick={saveLead}>Salvar</Button></>}>
        {edit && (
          <>
            <Field label="Nome da criança"><TextInput value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Responsável"><TextInput value={edit.resp} onChange={(e) => setEdit({ ...edit, resp: e.target.value })} /></Field>
            <Field label="Origem"><Select value={edit.origem ?? ''} onChange={(e) => setEdit({ ...edit, origem: e.target.value })}>
              <option value="">Não informada</option>
              {ORIGENS.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select></Field>
            <Field label="Observação"><TextInput value={edit.info} onChange={(e) => setEdit({ ...edit, info: e.target.value })} /></Field>
            <Field label="Etapa do funil"><Select value={editStage} onChange={(e) => setEditStage(Number(e.target.value))}>{stages.map((s, i) => <option key={s} value={i}>{s}</option>)}</Select></Field>
          </>
        )}
      </Modal>

      {/* Editar modelo de mensagem */}
      <Modal open={!!msg} onClose={() => setMsg(null)} title={msg?.title ?? ''} subtitle={`Dispara ${msg?.when ?? ''}`} width={460}
        footer={<><Button variant="outline" onClick={() => setMsg(null)}>Cancelar</Button><Button onClick={saveMsg}>Salvar modelo</Button></>}>
        <Field label="Mensagem (WhatsApp)"><Textarea value={msgText} onChange={(e) => setMsgText(e.target.value)} /></Field>
        <div style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Variáveis: {'{crianca}'}, {'{responsavel}'}, {'{data}'}.</div>
      </Modal>

      <ConfirmDialog open={!!confirmLead} onClose={() => setConfirmLead(null)} onConfirm={() => { if (confirmLead) { deleteLead(confirmLead.id); toast('Lead excluído.') } }}
        title="Excluir lead" message={`Remover ${confirmLead?.name ?? ''} do funil?`} />
    </>
  )
}
