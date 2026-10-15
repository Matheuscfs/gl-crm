import { useState } from 'react'
import { Icon } from '../../icons'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Field, Textarea } from '../../components/Field'
import { Menu } from '../../components/Menu'
import { EmptyState } from '../../components/States'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useToast } from '../../components/Toast'
import { useCollection, usePatient } from '../../lib/useCollection'
import { DateField } from '../../components/DateField'
import { SuggestInput } from '../../components/SuggestInput'
import { PrintDoc } from '../../components/PrintDoc'
import { useStore } from '../../store'
import { todayISO, brDate, brToIso } from '../../lib/dates'
import { historico } from '../../data'
import { esquema } from '../../lib/sync'
import { supabase } from '../../lib/supabase'
import { HistoricoAlteracoes } from '../../components/HistoricoAlteracoes'
import { DOCUMENTS } from '../documents/templates'
import { useClinic } from '../../lib/clinic'

interface Evo { id: string; date: string; proc: string; prof: string; note: string; anuladaEm?: string; anuladaMotivo?: string }

/** Registro clínico não se apaga: anula-se com motivo (fica riscado e visível). Sem a migração 0026 ainda dá para excluir. */
const podeAnular = () => !supabase || esquema.v26

export default function Evolucao() {
  const { toast } = useToast()
  const { patient, patientId, demo } = usePatient()
  const { procedimentos } = useStore()
  const clinic = useClinic()

  // evoluções demo só nos pacientes de demonstração — cadastro novo começa vazio
  const seed: Evo[] = demo
    ? historico.map((h, i) => ({ id: `seed-ev${i}`, date: h.date, proc: h.proc, prof: h.prof, note: h.note }))
    : []
  const { rows, add, save, remove } = useCollection<Evo>(
    'evolucoes',
    patientId,
    (r) => ({ id: r.id as string, date: (r.evo_date as string) ?? '', proc: (r.proc as string) ?? '', prof: (r.prof as string) ?? '', note: (r.note as string) ?? '', anuladaEm: (r.anulada_em as string) ?? undefined, anuladaMotivo: (r.anulada_motivo as string) ?? undefined }),
    (e) => ({ evo_date: e.date, proc: e.proc, prof: e.prof, note: e.note, ...(esquema.v26 ? { anulada_em: e.anuladaEm, anulada_motivo: e.anuladaMotivo } : {}) }),
    seed,
  )

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ date: todayISO(), proc: '', note: '' })
  const [confirmDel, setConfirmDel] = useState<Evo | null>(null)
  const [anulando, setAnulando] = useState<Evo | null>(null)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [printing, setPrinting] = useState(false)

  const sorted = [...rows].sort((a, b) => brToIso(b.date).localeCompare(brToIso(a.date)))

  const submit = async () => {
    if (salvando) return
    if (!form.note.trim()) return toast('Descreva a evolução do atendimento.', 'error')
    if (!form.date) return toast('Informe a data.', 'error')
    setSalvando(true)
    const ok = await add({ date: brDate(form.date), proc: form.proc.trim(), prof: clinic.profissional, note: form.note.trim() })
    setSalvando(false)
    if (!ok) return
    setOpen(false)
    setForm({ date: todayISO(), proc: '', note: '' })
    toast('Evolução registrada.')
  }

  const anular = async () => {
    if (!anulando) return
    if (motivo.trim().length < 5) return toast('Escreva o motivo da anulação (ex.: lançado no paciente errado).', 'error')
    setSalvando(true)
    const ok = await save({ ...anulando, anuladaEm: new Date().toISOString(), anuladaMotivo: motivo.trim() })
    setSalvando(false)
    if (!ok) return
    setAnulando(null)
    setMotivo('')
    toast('Evolução anulada — o registro continua visível, riscado, com o motivo.')
  }

  // impressão reaproveita o template "Ficha de Evolução" do kit de documentos
  const fichaNode = DOCUMENTS.find((d) => d.key === 'evolucao')?.node
  const fichaCtx = {
    patientName: patient?.name ?? '',
    birthdate: patient?.birthdate,
    evolucoes: [...sorted].reverse().filter((e) => !e.anuladaEm).map((e) => ({ date: e.date, proc: e.proc, prof: e.prof, note: e.note })),
  }

  return (
    <div className="tab-body">
      <div className="tab-narrow">
        <div className="tab-head">
          <h2 className="panel-title">Ficha de evolução <span>{sorted.filter((e) => !e.anuladaEm).length}</span></h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className="btn-soft" style={{ height: 40, padding: '0 14px', borderRadius: 11 }} onClick={() => setHistoricoAberto(true)}>Histórico de alterações</button>
            <button className="btn-soft" style={{ height: 40, padding: '0 14px', borderRadius: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setPrinting(true)}>
              <Icon name="print" size={15} /> Imprimir ficha
            </button>
            <button className="btn-cta" onClick={() => { setForm({ date: todayISO(), proc: '', note: '' }); setOpen(true) }}><Icon name="plus" size={16} /> Nova evolução</button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="panel">
            <EmptyState icon="clipboard" title="Nenhuma evolução registrada" desc="Registre a evolução clínica de cada sessão — conduta, intercorrências e orientações."
              action={<Button onClick={() => setOpen(true)}>Nova evolução</Button>} />
          </div>
        ) : (
          <div className="stack">
            {sorted.map((e) => (
              <article key={e.id} className={`panel${e.anuladaEm ? ' anulada' : ''}`}>
                <div className="entry-head">
                  <span style={{ font: '600 12.5px var(--font)', color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{e.date}</span>
                  {e.proc && <span className="ficha-chip">{e.proc}</span>}
                  <span style={{ flex: '1 1 0' }} />
                  <span style={{ font: '400 12px var(--font)', color: 'var(--muted)' }}>{e.prof}</span>
                  {!e.anuladaEm && (
                    <Menu items={[podeAnular()
                      ? { label: 'Anular (com motivo)', danger: true, onClick: () => { setMotivo(''); setAnulando(e) } }
                      : { label: 'Excluir', danger: true, onClick: () => setConfirmDel(e) }]} />
                  )}
                </div>
                <p className="entry-text">{e.note}</p>
                {e.anuladaEm && <p className="entry-anulada">Anulada em {brDate(e.anuladaEm.slice(0, 10))}: {e.anuladaMotivo}</p>}
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova evolução" subtitle="Registro clínico da sessão" width={480} dirty={!!(form.note.trim() || form.proc.trim())}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button loading={salvando} onClick={() => void submit()}>Registrar</Button></>}>
        <div className="field-row">
          <Field label="Data"><DateField value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} /></Field>
          <Field label="Procedimento (opcional)">
            <SuggestInput value={form.proc} options={procedimentos.map((p) => ({ value: p.proc, sub: p.cat || undefined }))}
              placeholder="Ex.: Profilaxia" emptyText="Fora da tabela — texto livre." onChange={(v) => setForm({ ...form, proc: v })} />
          </Field>
        </div>
        <Field label="Evolução">
          <Textarea autoFocus rows={5} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Conduta realizada, intercorrências, orientações passadas, plano para a próxima sessão…" />
        </Field>
        <div style={{ font: "600 11px var(--font)", color: 'var(--muted)' }}>Assinado por {clinic.profissional}{clinic.cro ? ` · ${clinic.cro}` : ''}</div>
      </Modal>

      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)}
        onConfirm={async () => { if (confirmDel && await remove(confirmDel.id)) toast('Evolução excluída.') }}
        title="Excluir evolução" message={`Remover o registro de ${confirmDel?.date ?? ''}?`} />

      <Modal open={!!anulando} onClose={() => setAnulando(null)} title="Anular evolução" subtitle={anulando ? `${anulando.date}${anulando.proc ? ` · ${anulando.proc}` : ''}` : ''} width={440}
        footer={<><Button variant="outline" onClick={() => setAnulando(null)}>Cancelar</Button><Button loading={salvando} variant="danger" onClick={() => void anular()}>Anular</Button></>}>
        <p style={{ margin: 0, font: '400 13px/1.5 var(--font)', color: 'var(--text-2)' }}>
          O prontuário não pode ser apagado. A evolução fica riscada, com o motivo, a data e quem anulou — e sai das impressões.
        </p>
        <Field label="Motivo"><Textarea autoFocus rows={3} value={motivo} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Ex.: registrado no paciente errado; texto corrigido em nova evolução." /></Field>
      </Modal>

      <HistoricoAlteracoes open={historicoAberto} onClose={() => setHistoricoAberto(false)} patientId={patientId} nome={patient?.name} />

      <PrintDoc open={printing} title="Ficha de Evolução" onClose={() => setPrinting(false)}>
        {fichaNode ? fichaNode(false, fichaCtx) : null}
      </PrintDoc>
    </div>
  )
}
