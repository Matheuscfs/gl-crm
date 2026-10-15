import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Icon } from '../../icons'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Field, TextInput, Select } from '../../components/Field'
import { Menu } from '../../components/Menu'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/States'
import { useToast } from '../../components/Toast'
import { useStore } from '../../store'
import { useCollection, usePatientId } from '../../lib/useCollection'
import { DocumentViewer, type DocRef } from '../documents/DocKit'
import { DOCUMENTS, ADMISSION } from '../documents/templates'
import { PERFIL, isSeedPatient } from '../../data'
import { useGoogle } from '../../lib/GoogleProvider'
import { uploadToDrive } from '../../lib/googleDrive'
import { useAnamnese } from '../../lib/useAnamnese'
import { supabase } from '../../lib/supabase'
import { brToIso, brDate, todayISO } from '../../lib/dates'

interface Doc {
  id: string
  name: string
  kind: string
  date: string
}
const SEED: Doc[] = [
  { id: 'seed-d1', name: 'RX panorâmico', kind: 'Imagem', date: '08/01/2026' },
  { id: 'seed-d2', name: 'Termo de consentimento', kind: 'PDF', date: '15/06/2025' },
  { id: 'seed-d3', name: 'Orçamento Plano #218', kind: 'PDF', date: '15/07/2026' },
]

export default function Documentos() {
  const { toast } = useToast()
  const patientId = usePatientId()
  const { id } = useParams()
  // anexos demo só para pacientes de demonstração — cadastro novo começa sem arquivos
  const isDemo = isSeedPatient(id ? decodeURIComponent(id) : '')
  const { rows: docs, add, remove } = useCollection<Doc>(
    'documents',
    patientId,
    (r) => ({ id: r.id as string, name: r.name as string, kind: (r.kind as string) ?? '', date: (r.doc_date as string) ?? '' }),
    (item) => ({ name: item.name, kind: item.kind, doc_date: item.date }),
    isDemo ? SEED : [],
  )
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', kind: 'PDF' })
  const [confirmDel, setConfirmDel] = useState<Doc | null>(null)
  const google = useGoogle()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  const anexar = () => {
    const nome = form.name.trim() || file?.name
    if (!nome) return toast('Informe o nome ou escolha um arquivo.', 'error')
    add({ name: nome, kind: form.kind, date: brDate(todayISO()) })
    if (file && google.connected) {
      uploadToDrive(current?.name ?? 'Paciente', file, nome).then((r) => { if (r) toast('Documento enviado ao Google Drive.', 'info') })
    }
    setAdding(false)
    setFile(null)
    toast('Documento anexado.')
  }

  // perfil do paciente da ficha (define quais documentos se aplicam)
  const { patients } = useStore()
  const current = patients.find((p) => p.name === (id ? decodeURIComponent(id) : ''))
  const perfil = current?.perfil ?? 'pediatrico'
  // documentos se agrupam em pediátrico x adulto (estético usa o pacote adulto)
  const docPerfil = perfil === 'pediatrico' ? 'pediatrico' : 'adulto'

  const [viewer, setViewer] = useState<{ docs: DocRef[]; blank: boolean } | null>(null)
  const applicable = DOCUMENTS.filter((d) => d.perfil === 'ambos' || d.perfil === docPerfil)

  // contexto real para os documentos (anamnese + tratamentos do paciente)
  const anamnese = useAnamnese(patientId)
  const [treatments, setTreatments] = useState<{ date: string; proc: string; prof?: string; note?: string }[]>([])
  const [evolucoes, setEvolucoes] = useState<{ date: string; proc: string; prof?: string; note?: string }[]>([])
  const [teeth, setTeeth] = useState<{ num: number; state: string }[]>([])
  useEffect(() => {
    if (!supabase || !patientId) return
    let cancelled = false
    supabase.from('treatments').select('treat_date,proc,prof,note').eq('patient_id', patientId).then(({ data, error }) => {
      if (cancelled || error || !data) return
      setTreatments(data.map((r) => ({ date: (r.treat_date as string) ?? '', proc: (r.proc as string) ?? '', prof: (r.prof as string) ?? '', note: (r.note as string) ?? '' })))
    })
    supabase.from('evolucoes').select('evo_date,proc,prof,note').eq('patient_id', patientId).then(({ data, error }) => {
      if (cancelled || error || !data) return
      setEvolucoes(data.map((r) => ({ date: (r.evo_date as string) ?? '', proc: (r.proc as string) ?? '', prof: (r.prof as string) ?? '', note: (r.note as string) ?? '' })))
    })
    supabase.from('teeth').select('num,state').eq('patient_id', patientId).then(({ data, error }) => {
      if (cancelled || error || !data) return
      setTeeth(data.map((r) => ({ num: r.num as number, state: r.state as string })))
    })
    return () => { cancelled = true }
  }, [patientId])
  // a Ficha de Evolução junta atendimentos (Tratamentos) e registros da aba Evolução, em ordem cronológica
  const evolucaoMerged = [...treatments, ...evolucoes].sort((a, b) => brToIso(a.date).localeCompare(brToIso(b.date)))
  const docCtx = { patientName: current?.name, sex: current?.sex, birthdate: current?.birthdate, cpf: current?.cpf, resp: current?.resp, respCpf: current?.respCpf, anamnese, treatments, evolucoes: evolucaoMerged, teeth }
  const openDoc = (key: string, title: string, node: DocRef['node'], blank: boolean) => setViewer({ docs: [{ key, title, node }], blank })
  const openPacote = () => {
    const docs = ADMISSION[docPerfil].map((k) => { const d = DOCUMENTS.find((x) => x.key === k)!; return { key: d.key, title: d.title, node: d.node } })
    setViewer({ docs, blank: false })
  }

  return (
    <div className="tab-body">
      {/* Documentos para impressão */}
      <section className="panel" aria-labelledby="impr-titulo" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2 id="impr-titulo" className="panel-title">Documentos para impressão</h2>
          <button className="btn-cta sm" onClick={openPacote}><Icon name="print" size={15} /> Pacote de admissão</button>
        </div>
        <p className="panel-sub" style={{ margin: '4px 0 12px' }}>
          Perfil {PERFIL[perfil].label} · gere preenchido (dados da ficha) ou em branco para preencher à mão.
        </p>
        <div className="auto-grid" style={{ '--min': '300px' } as React.CSSProperties}>
          {applicable.map((d) => (
            <div key={d.key} className="doc-line">
              <span>{d.title}</span>
              <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                <button className="chip-opt primary" onClick={() => openDoc(d.key, d.title, d.node, false)}>Preenchido</button>
                <button className="chip-opt" onClick={() => openDoc(d.key, d.title, d.node, true)}>Em branco</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="tab-head">
        <h2 className="panel-title">Arquivos anexados <span>{docs.length}</span></h2>
        <button className="btn-cta" onClick={() => { setForm({ name: '', kind: 'PDF' }); setAdding(true) }}><Icon name="plus" size={16} /> Adicionar documento</button>
      </div>

      {docs.length === 0 ? (
        <div className="panel"><EmptyState title="Nenhum documento" desc="Anexe RX, termos e orçamentos do paciente." action={<Button onClick={() => setAdding(true)}>Adicionar documento</Button>} /></div>
      ) : (
        <div className="auto-grid" style={{ '--min': '220px', gap: 14 } as React.CSSProperties}>
          {docs.map((d) => (
            <article key={d.id} className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: 42, height: 50, borderRadius: 10, background: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon name="clipboard" size={20} />
                </div>
                <Menu items={[
                  { label: 'Excluir', danger: true, onClick: () => setConfirmDel(d) },
                ]} />
              </div>
              <div style={{ font: '500 13.5px var(--font)', color: 'var(--ink)', overflowWrap: 'anywhere' }}>{d.name}</div>
              <div style={{ font: '400 12px var(--font)', color: 'var(--muted)', marginTop: 3 }}>{d.kind} · {d.date}</div>
            </article>
          ))}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Adicionar documento" subtitle="Anexe um arquivo à ficha" width={420}
        footer={<><Button variant="outline" onClick={() => setAdding(false)}>Cancelar</Button><Button onClick={anexar}>Anexar</Button></>}>
        <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!form.name) setForm({ ...form, name: f.name }) } }} />
        <button onClick={() => fileRef.current?.click()} style={{ width: '100%', border: '2px dashed var(--primary-border)', borderRadius: 12, padding: '20px', textAlign: 'center', background: 'var(--bg-soft)', color: file ? 'var(--primary-dark)' : 'var(--muted)', font: "700 12px var(--font)", cursor: 'pointer' }}>
          {file ? `✓ ${file.name}` : 'Clique para escolher um arquivo'}
        </button>
        <Field label="Nome do documento"><TextInput autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: RX periapical" /></Field>
        <Field label="Tipo"><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option>PDF</option><option>Imagem</option><option>Documento</option></Select></Field>
        {google.connected && <div style={{ font: "600 11px var(--font)", color: 'var(--muted)' }}>O arquivo será enviado ao Google Drive (pasta do paciente).</div>}
      </Modal>

      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => { if (confirmDel) { remove(confirmDel.id); toast('Documento excluído.') } }}
        title="Excluir documento" message={`Remover "${confirmDel?.name ?? ''}"?`} />

      <DocumentViewer open={!!viewer} onClose={() => setViewer(null)} docs={viewer?.docs ?? []} blank={viewer?.blank ?? false} ctx={docCtx} />
    </div>
  )
}
