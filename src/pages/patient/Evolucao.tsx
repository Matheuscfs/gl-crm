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
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, maxWidth: 840 }}>
        <div style={{ font: "800 15px 'Plus Jakarta Sans'", color: '#26324a' }}>
          Ficha de evolução <span style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>({sorted.length})</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" icon={<Icon name="print" size={16} />} onClick={() => setPrinting(true)}>Imprimir ficha</Button>
          <Button icon={<Icon name="plus" size={17} />} onClick={() => { setForm({ date: todayISO(), proc: '', note: '' }); setOpen(true) }}>Nova evolução</Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="card" style={{ maxWidth: 840 }}>
          <EmptyState icon="clipboard" title="Nenhuma evolução registrada" desc="Registre a evolução clínica de cada sessão — conduta, intercorrências e orientações."
            action={<Button onClick={() => setOpen(true)}>Nova evolução</Button>} />
        </div>
      ) : (
        sorted.map((e) => (
          <div key={e.id} className="card card-hover" style={{ maxWidth: 840, padding: '14px 18px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span className="tnum" style={{ font: "700 12.5px 'JetBrains Mono'", color: '#2f52e0' }}>{e.date}</span>
              {e.proc && <span style={{ font: "700 10.5px 'Plus Jakarta Sans'", color: '#5b647a', background: '#eef2f9', padding: '3px 9px', borderRadius: 20 }}>{e.proc}</span>}
              <span style={{ flex: 1 }} />
              <span style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#8b93a7' }}>{e.prof}</span>
              <Menu items={[{ label: 'Excluir', danger: true, onClick: () => setConfirmDel(e) }]} />
            </div>
            <div style={{ font: "500 13px/1.65 'Plus Jakarta Sans'", color: '#26324a', whiteSpace: 'pre-wrap' }}>{e.note}</div>
          </div>
        ))
      )}

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
        <div style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Assinado por {BRAND.dentist} · {BRAND.cro}</div>
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
