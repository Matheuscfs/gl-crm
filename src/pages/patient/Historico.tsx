import { useState } from 'react'
import { Icon } from '../../icons'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Field, TextInput, Select, Textarea, FieldRow } from '../../components/Field'
import { Menu } from '../../components/Menu'
import { EmptyState } from '../../components/States'
import { useToast } from '../../components/Toast'
import { SuggestInput } from '../../components/SuggestInput'
import { DateField } from '../../components/DateField'
import { todayISO, brDate } from '../../lib/dates'
import { useParams } from 'react-router-dom'
import { useCollection, usePatientId } from '../../lib/useCollection'
import { useStore, matchFicha } from '../../store'
import { fmtMoney } from '../../lib/fmt'
import { historico as seedHist, FRANKL, isSeedPatient } from '../../data'
import { BRAND } from '../../brand'

interface Treat {
  id: string
  date: string
  proc: string
  prof: string
  frankl: number
  note: string
}
const SEED: Treat[] = seedHist.map((h, i) => ({ id: `seed-h${i}`, date: h.date, proc: h.proc, prof: h.prof, frankl: h.frankl, note: h.note }))
const EMPTY: Omit<Treat, 'id'> = { date: todayISO(), proc: '', prof: BRAND.dentist, frankl: 3, note: '' }

export default function Historico() {
  const { toast } = useToast()
  const patientId = usePatientId()
  const { baixaProcedimento, gerarCobranca, procedimentos } = useStore()
  const { id } = useParams()
  const fullName = id ? decodeURIComponent(id) : ''
  const patientName = fullName.split(' ')[0] || 'paciente'
  const [autoBaixa, setAutoBaixa] = useState(true)
  const [autoCobranca, setAutoCobranca] = useState(true)
  const { rows, add, remove } = useCollection<Treat>(
    'treatments',
    patientId,
    (r) => ({ id: r.id as string, date: (r.treat_date as string) ?? '', proc: (r.proc as string) ?? '', prof: (r.prof as string) ?? '', frankl: (r.frankl as number) ?? 0, note: (r.note as string) ?? '' }),
    (t) => ({ treat_date: t.date, proc: t.proc, prof: t.prof, frankl: t.frankl, note: t.note }),
    isSeedPatient(fullName) ? SEED : [], // tratamentos demo só nos pacientes de demonstração
  )
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const submit = () => {
    if (!form.proc.trim()) return toast('Informe o procedimento.', 'error')
    if (!form.date) return toast('Informe a data do atendimento.', 'error')
    // o histórico armazena a data em dd/mm/aaaa; o form trabalha em ISO (DateField)
    add({ ...form, date: brDate(form.date), frankl: Number(form.frankl) })
    // baixa automática no estoque + cobrança no financeiro
    const parts: string[] = []
    if (autoBaixa) {
      const consumidos = baixaProcedimento(form.proc, patientName)
      if (consumidos > 0) parts.push(`${consumidos} itens baixados do estoque`)
    }
    if (autoCobranca) {
      const v = gerarCobranca(form.proc, fullName)
      if (v > 0) parts.push(`cobrança de ${fmtMoney(v)} gerada`)
    }
    toast(parts.length ? `Atendimento registrado · ${parts.join(' · ')}.` : 'Atendimento registrado.')
    setOpen(false)
    setForm(EMPTY)
  }
  const matched = matchFicha(procedimentos, form.proc)
  const hasBom = !!matched && matched.lines.length > 0
  const cobrancaVal = matched?.val ?? 0

  return (
    <div className="tab-body">
      <div className="tab-narrow">
        <div className="tab-head">
          <h2 className="panel-title">Tratamentos executados <span>{rows.length}</span></h2>
          <button className="btn-cta" onClick={() => { setForm(EMPTY); setOpen(true) }}><Icon name="plus" size={16} /> Novo atendimento</button>
        </div>

        {rows.length === 0 ? (
          <div className="panel"><EmptyState icon="cal" title="Nenhum atendimento registrado" desc="Registre o primeiro atendimento deste paciente." action={<Button onClick={() => setOpen(true)}>Novo atendimento</Button>} /></div>
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {rows.map((h, i) => {
              const frk = FRANKL[h.frankl]
              const last = i === rows.length - 1
              return (
                <li key={h.id} className="tl-row">
                  <div className="tl-date">{h.date}</div>
                  <div className="tl-rail" aria-hidden="true"><span className="dot" />{!last && <span className="line" />}</div>
                  <article className="panel tl-card">
                    <div className="entry-head">
                      <span className="when">{h.date} ·</span>
                      <h3 style={{ margin: 0, flex: '1 1 160px', minWidth: 0, font: '500 14px var(--font)', color: 'var(--ink)' }}>{h.proc}</h3>
                      {frk && <span style={{ padding: '3px 10px', borderRadius: 20, font: '600 11px var(--font)', whiteSpace: 'nowrap', background: frk.bg, color: frk.fg }}>Frankl {frk.label}</span>}
                      <span style={{ marginLeft: 'auto' }}><Menu items={[{ label: 'Excluir', danger: true, onClick: () => { remove(h.id); toast('Atendimento removido.') } }]} /></span>
                    </div>
                    <div style={{ font: '400 12px var(--font)', color: 'var(--muted)', marginTop: 3 }}>{h.prof}</div>
                    {h.note && <p className="entry-text">{h.note}</p>}
                  </article>
                </li>
              )
            })}
          </ol>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo atendimento" subtitle="Registro na timeline do paciente" dirty={!!(form.proc.trim() || form.note.trim())}
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={submit}>Registrar</Button></>}>
        <FieldRow>
          <Field label="Data"><DateField value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} /></Field>
          <Field label="Escala Frankl"><Select value={form.frankl} onChange={(e) => setForm({ ...form, frankl: Number(e.target.value) })}><option value={0}>Não se aplica</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{FRANKL[n].label}</option>)}</Select></Field>
        </FieldRow>
        <Field label="Procedimento">
          <SuggestInput
            autoFocus
            value={form.proc}
            options={procedimentos.map((p) => ({ value: p.proc, sub: p.cat || undefined }))}
            placeholder="Ex.: Profilaxia + flúor"
            emptyText="Sem correspondência — será registrado como digitado."
            onChange={(v) => setForm({ ...form, proc: v })}
          />
        </Field>
        <Field label="Profissional"><TextInput value={form.prof} onChange={(e) => setForm({ ...form, prof: e.target.value })} /></Field>
        <Field label="Observações"><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Conduta, intercorrências, orientações…" /></Field>
        {hasBom && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 4, padding: '10px 12px', background: 'var(--primary-bg)', borderRadius: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoBaixa} onChange={(e) => setAutoBaixa(e.target.checked)} style={{ accentColor: 'var(--primary)', width: 15, height: 15 }} />
            <span style={{ font: "600 11.5px/1.4 var(--font)", color: 'var(--primary-dark)' }}>Dar baixa automática dos materiais da ficha técnica deste procedimento no estoque.</span>
          </label>
        )}
        {cobrancaVal > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 4, padding: '10px 12px', background: 'var(--green-bg)', borderRadius: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoCobranca} onChange={(e) => setAutoCobranca(e.target.checked)} style={{ accentColor: '#2f9a5b', width: 15, height: 15 }} />
            <span style={{ font: "600 11.5px/1.4 var(--font)", color: 'var(--green-dark)' }}>Gerar cobrança de <b>{fmtMoney(cobrancaVal)}</b> em contas a receber (Financeiro).</span>
          </label>
        )}
      </Modal>
    </div>
  )
}
