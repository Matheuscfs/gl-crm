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
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, maxWidth: 840 }}>
        <div style={{ font: "800 15px 'Plus Jakarta Sans'", color: '#26324a' }}>Tratamentos executados ({rows.length})</div>
        <Button icon={<Icon name="plus" size={17} />} onClick={() => { setForm(EMPTY); setOpen(true) }}>Novo atendimento</Button>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ maxWidth: 840 }}><EmptyState icon="cal" title="Nenhum atendimento registrado" desc="Registre o primeiro atendimento deste paciente." action={<Button onClick={() => setOpen(true)}>Novo atendimento</Button>} /></div>
      ) : (
        <div style={{ maxWidth: 840 }}>
          {rows.map((h, i) => {
            const frk = FRANKL[h.frankl]
            const last = i === rows.length - 1
            return (
              <div key={h.id} style={{ display: 'flex', gap: 18 }}>
                <div style={{ width: 92, textAlign: 'right', font: "700 12px 'JetBrains Mono'", color: '#5b647a', paddingTop: 3, flex: 'none' }}>{h.date}</div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'stretch', flex: 'none' }}>
                  <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#3f6bf5', boxShadow: '0 0 0 3px #dbe4ff', marginTop: 4 }} />
                  {!last && <span style={{ width: 2, flex: 1, background: '#eceff6', margin: '4px 0' }} />}
                </div>
                <div className="card card-hover" style={{ flex: 1, padding: '15px 18px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a' }}>{h.proc}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {frk && <span style={{ padding: '3px 10px', borderRadius: 20, font: "700 11px 'Plus Jakarta Sans'", whiteSpace: 'nowrap', background: frk.bg, color: frk.fg }}>Frankl {frk.label}</span>}
                      <Menu items={[{ label: 'Excluir', danger: true, onClick: () => { remove(h.id); toast('Atendimento removido.') } }]} />
                    </div>
                  </div>
                  <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#8b93a7', margin: '3px 0 8px' }}>{h.prof}</div>
                  <div style={{ font: "500 12.5px/1.5 'Plus Jakarta Sans'", color: '#5b647a' }}>{h.note}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

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
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 4, padding: '10px 12px', background: '#e9eeff', borderRadius: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoBaixa} onChange={(e) => setAutoBaixa(e.target.checked)} style={{ accentColor: '#3f6bf5', width: 15, height: 15 }} />
            <span style={{ font: "600 11.5px/1.4 'Plus Jakarta Sans'", color: '#2f52e0' }}>Dar baixa automática dos materiais da ficha técnica deste procedimento no estoque.</span>
          </label>
        )}
        {cobrancaVal > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 4, padding: '10px 12px', background: '#e7f6ee', borderRadius: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoCobranca} onChange={(e) => setAutoCobranca(e.target.checked)} style={{ accentColor: '#2f9a5b', width: 15, height: 15 }} />
            <span style={{ font: "600 11.5px/1.4 'Plus Jakarta Sans'", color: '#217a47' }}>Gerar cobrança de <b>{fmtMoney(cobrancaVal)}</b> em contas a receber (Financeiro).</span>
          </label>
        )}
      </Modal>
    </div>
  )
}
