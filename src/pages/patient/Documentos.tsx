import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../icons'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Field, TextInput, Select, FieldRow } from '../../components/Field'
import { DateField } from '../../components/DateField'
import { Menu } from '../../components/Menu'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/States'
import { useToast } from '../../components/Toast'
import { useStore } from '../../store'
import { useCollection, usePatient } from '../../lib/useCollection'
import { DocumentViewer, type DocRef, type Emissao, type ItemReceita } from '../documents/DocKit'
import { DOCUMENTS, ADMISSION, type DocDef } from '../documents/templates'
import { PERFIL, fmtHour } from '../../data'
import { useGoogle } from '../../lib/GoogleProvider'
import { uploadToDrive } from '../../lib/googleDrive'
import { useAnamnese } from '../../lib/useAnamnese'
import { supabase } from '../../lib/supabase'
import { esquema } from '../../lib/sync'
import { enviarArquivo, linkArquivo, removerArquivo } from '../../lib/arquivos'
import { brToIso, brDate, todayISO } from '../../lib/dates'

interface Doc {
  id: string
  name: string
  kind: string
  date: string
  /** Caminho do anexo no bucket privado (migração 0026). */
  storagePath?: string
  mime?: string
  /** anexo | radiografia | foto | exame | termo | receituario | atestado | declaracao */
  tipoDoc?: string
  /** Conteúdo do documento emitido, para reimprimir igual. */
  payload?: Emissao & { key?: string }
  dente?: string
}
const SEED: Doc[] = [
  { id: 'seed-d1', name: 'RX panorâmico', kind: 'Radiografia', date: '08/01/2026', tipoDoc: 'radiografia' },
  { id: 'seed-d2', name: 'Termo de consentimento', kind: 'Termo assinado', date: '15/06/2025', tipoDoc: 'termo' },
  { id: 'seed-d3', name: 'Orçamento Plano #218', kind: 'PDF', date: '15/07/2026', tipoDoc: 'anexo' },
]

const TIPOS_ANEXO: { value: string; label: string }[] = [
  { value: 'radiografia', label: 'Radiografia' },
  { value: 'foto', label: 'Foto intraoral' },
  { value: 'exame', label: 'Exame / laudo' },
  { value: 'termo', label: 'Termo assinado' },
  { value: 'anexo', label: 'Outro documento' },
]
const rotuloTipo = (v?: string) => TIPOS_ANEXO.find((t) => t.value === v)?.label

/** Horários de 30 em 30 min para os campos "das … às …". */
const HORAS = Array.from({ length: 29 }, (_, i) => 7 + i / 2)

const ITEM_VAZIO: ItemReceita = { med: '', qtd: '', posologia: '' }

export default function Documentos() {
  const { toast } = useToast()
  const { patient: current, patientId, demo: isDemo } = usePatient()
  const { events } = useStore()
  // anexos demo só para pacientes de demonstração — cadastro novo começa sem arquivos
  const { rows: docs, add, remove } = useCollection<Doc>(
    'documents',
    patientId,
    (r) => ({
      id: r.id as string, name: r.name as string, kind: (r.kind as string) ?? '', date: (r.doc_date as string) ?? '',
      storagePath: (r.storage_path as string) ?? undefined, mime: (r.mime as string) ?? undefined, tipoDoc: (r.tipo_doc as string) ?? undefined,
      payload: (r.payload as Doc['payload']) ?? undefined, dente: (r.dente as string) ?? undefined,
    }),
    // colunas da 0026 só vão quando o banco já as tem
    (item) => ({
      name: item.name, kind: item.kind, doc_date: item.date,
      ...(esquema.v26 ? { storage_path: item.storagePath, mime: item.mime, tipo_doc: item.tipoDoc, payload: item.payload, dente: item.dente || null } : {}),
    }),
    isDemo ? SEED : [],
  )
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', tipo: 'radiografia', dente: '' })
  const [enviando, setEnviando] = useState(false)
  const [confirmDel, setConfirmDel] = useState<Doc | null>(null)
  const google = useGoogle()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  const anexar = async () => {
    if (enviando) return
    const nome = form.name.trim() || file?.name
    if (!nome) return toast('Informe o nome ou escolha um arquivo.', 'error')
    setEnviando(true)
    let storagePath: string | undefined
    if (file && patientId && supabase) {
      const r = await enviarArquivo(patientId, file)
      if ('erro' in r) { setEnviando(false); return toast(`Não foi possível enviar o arquivo: ${r.erro}`, 'error') }
      storagePath = r.path
    }
    const tipo = TIPOS_ANEXO.find((t) => t.value === form.tipo)
    const ok = await add({ name: nome, kind: tipo?.label ?? 'Documento', date: brDate(todayISO()), storagePath, mime: file?.type, tipoDoc: form.tipo, dente: form.dente.trim() || undefined })
    if (!ok && storagePath) void removerArquivo(storagePath)
    setEnviando(false)
    if (!ok) return
    if (file && google.connected) {
      uploadToDrive(current?.name ?? 'Paciente', file, nome).then((r) => { if (r) toast('Cópia enviada ao Google Drive.', 'info') })
    }
    setAdding(false)
    setFile(null)
    toast(storagePath ? 'Arquivo anexado ao prontuário.' : 'Documento registrado.')
  }

  const abrirAnexo = async (d: Doc, baixar = false) => {
    if (!d.storagePath) return
    const url = await linkArquivo(d.storagePath, baixar ? d.name : undefined)
    if (!url) return toast('Não foi possível abrir o arquivo agora.', 'error')
    window.open(url, '_blank', 'noopener')
  }

  const excluir = async (d: Doc) => {
    const ok = await remove(d.id)
    if (!ok) return
    if (d.storagePath) void removerArquivo(d.storagePath)
    toast('Documento excluído.')
  }

  // perfil do paciente da ficha (define quais documentos se aplicam)
  const perfil = current?.perfil ?? 'pediatrico'
  // documentos se agrupam em pediátrico x adulto (estético usa o pacote adulto)
  const docPerfil = perfil === 'pediatrico' ? 'pediatrico' : 'adulto'

  const [viewer, setViewer] = useState<{ docs: DocRef[]; blank: boolean; emissao?: Emissao } | null>(null)
  const applicable = DOCUMENTS.filter((d) => d.perfil === 'ambos' || d.perfil === docPerfil)
  const fixos = applicable.filter((d) => !d.emitir)
  const emitiveis = applicable.filter((d) => d.emitir)

  // contexto real para os documentos (anamnese + tratamentos do paciente)
  const anamnese = useAnamnese(patientId)
  const [treatments, setTreatments] = useState<{ date: string; proc: string; prof?: string; note?: string }[]>([])
  const [evolucoes, setEvolucoes] = useState<{ date: string; proc: string; prof?: string; note?: string }[]>([])
  const [teeth, setTeeth] = useState<{ num: number; state: string }[]>([])
  useEffect(() => {
    if (!supabase || !patientId) return
    let cancelled = false
    supabase.from('treatments').select('*').eq('patient_id', patientId).then(({ data, error }) => {
      if (cancelled || error || !data) return
      setTreatments(data.filter((r) => !r.anulada_em).map((r) => ({ date: (r.treat_date as string) ?? '', proc: (r.proc as string) ?? '', prof: (r.prof as string) ?? '', note: (r.note as string) ?? '' })))
    })
    supabase.from('evolucoes').select('*').eq('patient_id', patientId).then(({ data, error }) => {
      if (cancelled || error || !data) return
      setEvolucoes(data.filter((r) => !r.anulada_em).map((r) => ({ date: (r.evo_date as string) ?? '', proc: (r.proc as string) ?? '', prof: (r.prof as string) ?? '', note: (r.note as string) ?? '' })))
    })
    supabase.from('teeth').select('num,state').eq('patient_id', patientId).then(({ data, error }) => {
      if (cancelled || error || !data) return
      setTeeth(data.map((r) => ({ num: r.num as number, state: r.state as string })))
    })
    return () => { cancelled = true }
  }, [patientId])
  // a Ficha de Evolução junta atendimentos (Tratamentos) e registros da aba Evolução, em ordem cronológica
  const evolucaoMerged = [...treatments, ...evolucoes].sort((a, b) => brToIso(a.date).localeCompare(brToIso(b.date)))
  const docCtx = {
    patientName: current?.name, sex: current?.sex, birthdate: current?.birthdate, cpf: current?.cpf, resp: current?.resp,
    respCpf: current?.respCpf, anamnese, treatments, evolucoes: evolucaoMerged, teeth, demo: isDemo, emissao: viewer?.emissao,
  }
  const openDoc = (d: Pick<DocDef, 'key' | 'title' | 'node'>, blank: boolean, emissao?: Emissao) => setViewer({ docs: [{ key: d.key, title: d.title, node: d.node }], blank, emissao })
  const openPacote = () => {
    const pacote = ADMISSION[docPerfil].map((k) => { const d = DOCUMENTS.find((x) => x.key === k)!; return { key: d.key, title: d.title, node: d.node } })
    setViewer({ docs: pacote, blank: false })
  }

  /* ---------- emissão: receita, atestado, declaração ---------- */
  const [emitindo, setEmitindo] = useState<DocDef | null>(null)
  const atendimentoHoje = events.find((e) => e.date === todayISO() && e.status !== 'desmarcado' && (e.patientId === current?._id || e.child === current?.name))
  const respPrincipal = (current?.resp ?? '').split('·')[0].trim()
  const novoForm = () => ({
    data: todayISO(),
    uso: 'Uso interno',
    itens: [{ ...ITEM_VAZIO }],
    controleEspecial: false,
    inicio: String(atendimentoHoje?.start ?? 9),
    fim: String(atendimentoHoje ? atendimentoHoje.start + atendimentoHoje.dur : 10),
    dias: '0',
    cid: '',
    cidAutorizado: false,
    finalidade: '',
    para: (perfil === 'pediatrico' ? 'acompanhante' : 'paciente') as 'paciente' | 'acompanhante',
    acompanhante: respPrincipal && respPrincipal !== '—' ? respPrincipal : '',
  })
  const [ef, setEf] = useState(novoForm)
  const abrirEmissao = (d: DocDef) => { setEf(novoForm()); setEmitindo(d) }
  const setItem = (i: number, patch: Partial<ItemReceita>) => setEf((f) => ({ ...f, itens: f.itens.map((it, j) => (j === i ? { ...it, ...patch } : it)) }))

  const emitir = async () => {
    if (!emitindo) return
    const tipo = emitindo.emitir!
    if (!ef.data) return toast('Informe a data.', 'error')
    let emissao: Emissao = { data: ef.data }
    if (tipo === 'receita') {
      const itens = ef.itens.filter((it) => it.med.trim())
      if (!itens.length) return toast('Inclua pelo menos um medicamento.', 'error')
      if (itens.some((it) => !it.posologia.trim())) return toast('Informe a posologia de cada medicamento.', 'error')
      emissao = { ...emissao, receita: { uso: ef.uso, itens, controleEspecial: ef.controleEspecial } }
    } else if (Number(ef.fim) <= Number(ef.inicio)) {
      return toast('O horário final precisa ser depois do inicial.', 'error')
    } else if (tipo === 'atestado') {
      if (ef.cid.trim() && !ef.cidAutorizado) return toast('O CID só entra no atestado com a autorização do paciente — marque a confirmação ou apague o CID.', 'error')
      emissao = { ...emissao, atestado: { inicio: ef.inicio, fim: ef.fim, dias: Math.max(0, Number(ef.dias) || 0), cid: ef.cid.trim() || undefined, cidAutorizado: ef.cidAutorizado, finalidade: ef.finalidade.trim() || undefined } }
    } else {
      if (ef.para === 'acompanhante' && !ef.acompanhante.trim()) return toast('Informe o nome do acompanhante.', 'error')
      emissao = { ...emissao, declaracao: { inicio: ef.inicio, fim: ef.fim, para: ef.para, acompanhante: ef.acompanhante.trim() || undefined } }
    }
    // registra no prontuário (com o conteúdo, para reimprimir igual) e abre para imprimir
    const ok = await add({ name: `${emitindo.title} · ${brDate(ef.data)}`, kind: 'Emitido', date: brDate(ef.data), tipoDoc: tipo === 'receita' ? 'receituario' : tipo, payload: { ...emissao, key: emitindo.key } })
    if (!ok) return
    setEmitindo(null)
    openDoc(emitindo, false, emissao)
  }

  const reimprimir = (d: Doc) => {
    const def = DOCUMENTS.find((x) => x.key === d.payload?.key)
    if (!def) return toast('Documento sem conteúdo salvo para reimprimir.', 'error')
    openDoc(def, false, d.payload)
  }

  return (
    <div className="tab-body">
      {/* Emitir agora */}
      <section className="panel" aria-labelledby="emit-titulo" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2 id="emit-titulo" className="panel-title">Emitir</h2>
        </div>
        <p className="panel-sub" style={{ margin: '4px 0 12px' }}>Receita, atestado e declaração saem preenchidos e ficam guardados no prontuário para reimprimir.</p>
        <div className="auto-grid" style={{ '--min': '240px' } as React.CSSProperties}>
          {emitiveis.map((d) => (
            <div key={d.key} className="doc-line">
              <span>{d.title}</span>
              <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                <button className="chip-opt primary" onClick={() => abrirEmissao(d)}>Emitir</button>
                <button className="chip-opt" onClick={() => openDoc(d, true)}>Em branco</button>
              </div>
            </div>
          ))}
        </div>
      </section>

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
          {fixos.map((d) => (
            <div key={d.key} className="doc-line">
              <span>{d.title}</span>
              <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
                <button className="chip-opt primary" onClick={() => openDoc(d, false)}>Preenchido</button>
                <button className="chip-opt" onClick={() => openDoc(d, true)}>Em branco</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="tab-head">
        <h2 className="panel-title">Arquivos e documentos <span>{docs.length}</span></h2>
        <button className="btn-cta" onClick={() => { setForm({ name: '', tipo: 'radiografia', dente: '' }); setFile(null); setAdding(true) }}><Icon name="plus" size={16} /> Anexar arquivo</button>
      </div>

      {docs.length === 0 ? (
        <div className="panel"><EmptyState title="Nenhum documento" desc="Anexe radiografias, fotos intraorais, exames e termos assinados." action={<Button onClick={() => setAdding(true)}>Anexar arquivo</Button>} /></div>
      ) : (
        <div className="auto-grid" style={{ '--min': '220px', gap: 14 } as React.CSSProperties}>
          {docs.map((d) => (
            <article key={d.id} className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: 42, height: 50, borderRadius: 10, background: d.payload ? 'var(--green-bg)' : 'var(--primary-bg)', color: d.payload ? 'var(--green-dark)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Icon name={d.payload ? 'print' : 'clipboard'} size={20} />
                </div>
                <Menu items={[
                  ...(d.storagePath ? [{ label: 'Abrir', onClick: () => void abrirAnexo(d) }, { label: 'Baixar', onClick: () => void abrirAnexo(d, true) }] : []),
                  ...(d.payload ? [{ label: 'Reimprimir', onClick: () => reimprimir(d) }] : []),
                  { label: 'Excluir', danger: true, onClick: () => setConfirmDel(d) },
                ]} />
              </div>
              {d.storagePath ? (
                <button className="doc-name-link" onClick={() => void abrirAnexo(d)}>{d.name}</button>
              ) : (
                <div style={{ font: '500 13.5px var(--font)', color: 'var(--ink)', overflowWrap: 'anywhere' }}>{d.name}</div>
              )}
              <div style={{ font: '400 12px var(--font)', color: 'var(--muted)', marginTop: 3 }}>
                {rotuloTipo(d.tipoDoc) ?? d.kind}{d.dente ? ` · dente ${d.dente}` : ''} · {d.date}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Anexar */}
      <Modal open={adding} onClose={() => setAdding(false)} title="Anexar arquivo" subtitle="Fica no prontuário, em armazenamento privado" width={440}
        footer={<><Button variant="outline" onClick={() => setAdding(false)}>Cancelar</Button><Button loading={enviando} onClick={anexar}>Anexar</Button></>}>
        <input ref={fileRef} type="file" accept="image/*,application/pdf,.dcm" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!form.name) setForm({ ...form, name: f.name.replace(/\.[^.]+$/, '') }) } }} />
        <button onClick={() => fileRef.current?.click()} style={{ width: '100%', border: '2px dashed var(--primary-border)', borderRadius: 12, padding: '20px', textAlign: 'center', background: 'var(--bg-soft)', color: file ? 'var(--primary-dark)' : 'var(--muted)', font: "600 12.5px var(--font)", cursor: 'pointer' }}>
          {file ? `✓ ${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Escolher arquivo (imagem ou PDF, até 25 MB)'}
        </button>
        <Field label="Nome"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: RX periapical 55" /></Field>
        <FieldRow>
          <Field label="Tipo"><Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{TIPOS_ANEXO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
          <Field label="Dente (opcional)"><TextInput value={form.dente} inputMode="numeric" maxLength={5} onChange={(e) => setForm({ ...form, dente: e.target.value.replace(/[^\d,]/g, '') })} placeholder="Ex.: 55" /></Field>
        </FieldRow>
        {!patientId && <div style={{ font: "500 12px var(--font)", color: 'var(--amber-dark)' }}>Sem banco (demonstração): o arquivo não é enviado, só o registro aparece na lista.</div>}
        {google.connected && <div style={{ font: "500 12px var(--font)", color: 'var(--muted)' }}>Uma cópia também vai para a pasta do paciente no Google Drive.</div>}
      </Modal>

      {/* Emitir receita / atestado / declaração */}
      <Modal open={!!emitindo} onClose={() => setEmitindo(null)} title={emitindo ? `Emitir ${emitindo.title.toLowerCase()}` : ''} subtitle={current?.name ?? ''} width={emitindo?.emitir === 'receita' ? 600 : 460}
        footer={<><Button variant="outline" onClick={() => setEmitindo(null)}>Cancelar</Button><Button icon={<Icon name="print" size={16} />} onClick={() => void emitir()}>Emitir e imprimir</Button></>}>
        <Field label="Data"><DateField value={ef.data} onChange={(iso) => setEf({ ...ef, data: iso })} /></Field>
        {emitindo?.emitir === 'receita' && (
          <>
            <Field label="Uso"><Select value={ef.uso} onChange={(e) => setEf({ ...ef, uso: e.target.value })}><option>Uso interno</option><option>Uso externo</option><option>Uso tópico (bochecho / gel)</option></Select></Field>
            {ef.itens.map((it, i) => (
              <div key={i} className="receita-item">
                <FieldRow>
                  <Field label={`Medicamento ${i + 1}`}><TextInput value={it.med} onChange={(e) => setItem(i, { med: e.target.value })} placeholder="Ex.: Amoxicilina 500 mg" /></Field>
                  <Field label="Quantidade"><TextInput value={it.qtd} onChange={(e) => setItem(i, { qtd: e.target.value })} placeholder="Ex.: 21 cápsulas" /></Field>
                </FieldRow>
                <Field label="Posologia"><TextInput value={it.posologia} onChange={(e) => setItem(i, { posologia: e.target.value })} placeholder="Ex.: 1 cápsula de 8 em 8 horas por 7 dias" /></Field>
                {ef.itens.length > 1 && <button className="panel-link" onClick={() => setEf({ ...ef, itens: ef.itens.filter((_, j) => j !== i) })}>Remover</button>}
              </div>
            ))}
            {ef.itens.length < 6 && <button className="panel-link" onClick={() => setEf({ ...ef, itens: [...ef.itens, { ...ITEM_VAZIO }] })}>+ Adicionar medicamento</button>}
            <label className="check-line"><input type="checkbox" checked={ef.controleEspecial} onChange={(e) => setEf({ ...ef, controleEspecial: e.target.checked })} /> Receita de controle especial (2 vias, com identificação do comprador)</label>
          </>
        )}
        {(emitindo?.emitir === 'atestado' || emitindo?.emitir === 'declaracao') && (
          <FieldRow>
            <Field label="Das"><Select value={ef.inicio} onChange={(e) => setEf({ ...ef, inicio: e.target.value })}>{HORAS.map((h) => <option key={h} value={String(h)}>{fmtHour(h)}</option>)}</Select></Field>
            <Field label="Às"><Select value={ef.fim} onChange={(e) => setEf({ ...ef, fim: e.target.value })}>{HORAS.map((h) => <option key={h} value={String(h)}>{fmtHour(h)}</option>)}</Select></Field>
          </FieldRow>
        )}
        {emitindo?.emitir === 'atestado' && (
          <>
            <FieldRow>
              <Field label="Dias de afastamento"><TextInput inputMode="numeric" value={ef.dias} onChange={(e) => setEf({ ...ef, dias: e.target.value.replace(/\D/g, '').slice(0, 2) })} /></Field>
              <Field label="Finalidade (opcional)"><TextInput value={ef.finalidade} onChange={(e) => setEf({ ...ef, finalidade: e.target.value })} placeholder="Ex.: escola, trabalho" /></Field>
            </FieldRow>
            <Field label="CID (opcional)"><TextInput value={ef.cid} onChange={(e) => setEf({ ...ef, cid: e.target.value.toUpperCase() })} placeholder="Ex.: K02.1" /></Field>
            {ef.cid.trim() && <label className="check-line"><input type="checkbox" checked={ef.cidAutorizado} onChange={(e) => setEf({ ...ef, cidAutorizado: e.target.checked })} /> O paciente (ou responsável) autorizou incluir o CID</label>}
            <div style={{ font: "400 12px var(--font)", color: 'var(--muted)' }}>Dias de afastamento em 0 = atestado só do horário do atendimento.</div>
          </>
        )}
        {emitindo?.emitir === 'declaracao' && (
          <>
            <Field label="Para quem">
              <Select value={ef.para} onChange={(e) => setEf({ ...ef, para: e.target.value as 'paciente' | 'acompanhante' })}>
                <option value="paciente">O próprio paciente</option>
                <option value="acompanhante">O acompanhante (ex.: mãe ou pai no trabalho)</option>
              </Select>
            </Field>
            {ef.para === 'acompanhante' && <Field label="Nome do acompanhante"><TextInput value={ef.acompanhante} onChange={(e) => setEf({ ...ef, acompanhante: e.target.value })} /></Field>}
          </>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => { if (confirmDel) void excluir(confirmDel) }}
        title="Excluir documento" message={`Remover "${confirmDel?.name ?? ''}"?${confirmDel?.storagePath ? ' O arquivo também é apagado do armazenamento.' : ''}`} />

      <DocumentViewer open={!!viewer} onClose={() => setViewer(null)} docs={viewer?.docs ?? []} blank={viewer?.blank ?? false} ctx={docCtx} />
    </div>
  )
}
