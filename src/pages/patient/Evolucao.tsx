import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Icon } from '../../icons'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Field, Textarea } from '../../components/Field'
import { Menu } from '../../components/Menu'
import { EmptyState } from '../../components/States'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useToast } from '../../components/Toast'
import { useCollection, usePatientId } from '../../lib/useCollection'
import { DateField } from '../../components/DateField'
import { SuggestInput } from '../../components/SuggestInput'
import { PrintDoc } from '../../components/PrintDoc'
import { useStore } from '../../store'
import { todayISO, brDate, brToIso } from '../../lib/dates'
import { historico, isSeedPatient } from '../../data'
import { DOCUMENTS } from '../documents/templates'
import { BRAND } from '../../brand'

interface Evo { id: string; date: string; proc: string; prof: string; note: string }

export default function Evolucao() {
  const { toast } = useToast()
  const patientId = usePatientId()
  const { id } = useParams()
  const fullName = id ? decodeURIComponent(id) : ''
  const { procedimentos, patients } = useStore()
  const patient = patients.find((p) => p.name === fullName)

  // evoluções demo só nos pacientes de demonstração — cadastro novo começa vazio
  const seed: Evo[] = isSeedPatient(fullName)
    ? historico.map((h, i) => ({ id: `seed-ev${i}`, date: h.date, proc: h.proc, prof: h.prof, note: h.note }))
    : []
  const { rows, add, remove } = useCollection<Evo>(
    'evolucoes',
    patientId,
    (r) => ({ id: r.id as string, date: (r.evo_date as string) ?? '', proc: (r.proc as string) ?? '', prof: (r.prof as string) ?? '', note: (r.note as string) ?? '' }),
    (e) => ({ evo_date: e.date, proc: e.proc, prof: e.prof, note: e.note }),
    seed,
  )

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ date: todayISO(), proc: '', note: '' })
  const [confirmDel, setConfirmDel] = useState<Evo | null>(null)
  const [printing, setPrinting] = useState(false)

  const sorted = [...rows].sort((a, b) => brToIso(b.date).localeCompare(brToIso(a.date)))

  const submit = () => {
    if (!form.note.trim()) return toast('Descreva a evolução do atendimento.', 'error')
    if (!form.date) return toast('Informe a data.', 'error')
    add({ date: brDate(form.date), proc: form.proc.trim(), prof: BRAND.dentist, note: form.note.trim() })
    setOpen(false)
    setForm({ date: todayISO(), proc: '', note: '' })
    toast('Evolução registrada.')
  }

  // impressão reaproveita o template "Ficha de Evolução" do kit de documentos
  const fichaNode = DOCUMENTS.find((d) => d.key === 'evolucao')?.node
  const fichaCtx = {
    patientName: fullName,
    birthdate: patient?.birthdate,
    evolucoes: [...sorted].reverse().map((e) => ({ date: e.date, proc: e.proc, prof: e.prof, note: e.note })),
  }

  return (
    <div className="tab-body">
      <div className="tab-narrow">
        <div className="tab-head">
          <h2 className="panel-title">Ficha de evolução <span>{sorted.length}</span></h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
              <article key={e.id} className="panel">
                <div className="entry-head">
                  <span style={{ font: '600 12.5px var(--font)', color: 'var(--primary)', fontVariantNumeric: 'tabular-nums' }}>{e.date}</span>
                  {e.proc && <span className="ficha-chip">{e.proc}</span>}
                  <span style={{ flex: '1 1 0' }} />
                  <span style={{ font: '400 12px var(--font)', color: 'var(--muted)' }}>{e.prof}</span>
                  <Menu items={[{ label: 'Excluir', danger: true, onClick: () => setConfirmDel(e) }]} />
                </div>
                <p className="entry-text">{e.note}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nova evolução" subtitle="Registro clínico da sessão" width={480} dirty={!!(form.note.trim() || form.proc.trim())}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={submit}>Registrar</Button></>}>
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
        <div style={{ font: "600 11px var(--font)", color: 'var(--muted)' }}>Assinado por {BRAND.dentist} · {BRAND.cro}</div>
      </Modal>

      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)}
        onConfirm={() => { if (confirmDel) { remove(confirmDel.id); toast('Evolução excluída.') } }}
        title="Excluir evolução" message={`Remover o registro de ${confirmDel?.date ?? ''}?`} />

      <PrintDoc open={printing} title="Ficha de Evolução" onClose={() => setPrinting(false)}>
        {fichaNode ? fichaNode(false, fichaCtx) : null}
      </PrintDoc>
    </div>
  )
}
