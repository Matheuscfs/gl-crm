import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Field, TextInput, FieldRow } from '../../components/Field'
import { Menu } from '../../components/Menu'
import { useToast } from '../../components/Toast'
import { useCollection, usePatientId } from '../../lib/useCollection'
import { SuggestInput } from '../../components/SuggestInput'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store'
import { PrintDoc } from '../../components/PrintDoc'
import { planoItens, planoEstetico, isSeedPatient, type Perfil } from '../../data'

const GRID = '0.7fr 0.7fr 3fr 1.1fr 34px'
const GRID_EST = '1.2fr 2.4fr 0.8fr 1.1fr 34px'

interface Item { id: string; dente: string; face: string; regiao: string; proc: string; qtd: string; val: number }

const parseMoney = (s: string) => Number(String(s).replace(/[^\d,]/g, '').replace(',', '.')) || 0
const brMoney = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const seedPed: Item[] = planoItens.map((r, i) => ({ id: `seed-p${i}`, dente: r.dente, face: r.face, regiao: '', proc: r.proc, qtd: '', val: parseMoney(r.val) }))
const seedEst: Item[] = planoEstetico.map((r, i) => ({ id: `seed-e${i}`, dente: '', face: '', regiao: r.regiao, proc: r.proc, qtd: r.qtd, val: parseMoney(r.val) }))

export default function Planos({ perfil }: { perfil?: Perfil }) {
  const est = perfil === 'estetico'
  const { toast } = useToast()
  const patientId = usePatientId()
  const { patients, procedimentos } = useStore()
  const patient = patients.find((p) => (p as { _id?: string })._id === patientId)
  const { rows: items, add, remove } = useCollection<Item>(
    'plan_items',
    patientId,
    (r) => ({ id: r.id as string, dente: (r.dente as string) ?? '', face: (r.face as string) ?? '', regiao: (r.regiao as string) ?? '', proc: (r.proc as string) ?? '', qtd: (r.qtd as string) ?? '', val: Number(r.val) || 0 }),
    (it) => ({ dente: it.dente, face: it.face, regiao: it.regiao, proc: it.proc, qtd: it.qtd, val: it.val }),
    isSeedPatient(patient?.name) ? (est ? seedEst : seedPed) : [], // plano demo só nos pacientes de demonstração
  )
  const [approved, setApproved] = useState(false)
  const [discount, setDiscount] = useState(isSeedPatient(patient?.name) ? (est ? 150 : 40) : 0)
  const [sending, setSending] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ dente: '', face: '', regiao: '', proc: '', qtd: '', val: '' })

  // status/desconto do plano (persistido em plans)
  useEffect(() => {
    if (!supabase || !patientId) return
    let cancelled = false
    supabase.from('plans').select('status,discount').eq('patient_id', patientId).maybeSingle().then(({ data, error }) => {
      if (cancelled || error || !data) return
      setApproved(data.status === 'aprovado')
      if (typeof data.discount === 'number') setDiscount(data.discount)
    })
    return () => { cancelled = true }
  }, [patientId])

  const savePlan = (patch: { status?: string; discount?: number }) => {
    if (supabase && patientId) {
      supabase.from('plans').upsert({ patient_id: patientId, status: patch.status ?? (approved ? 'aprovado' : 'aguardando'), discount: patch.discount ?? discount }, { onConflict: 'patient_id' })
        .then(({ error }) => { if (error) console.error('[supabase] plans', error.message) })
    }
  }

  const subtotal = items.reduce((s, it) => s + it.val, 0)
  const total = Math.max(0, subtotal - discount)

  const aprovar = () => {
    setApproved(true)
    savePlan({ status: 'aprovado' })
    // gera as parcelas no financeiro (Fase 5 → 6)
    if (supabase && patientId && total > 0) {
      const n = 3
      const parcela = total / n
      const nome = patient?.name ?? 'Paciente'
      const resp = patient?.resp && patient.resp !== '—' ? patient.resp : nome
      const rows = Array.from({ length: n }, (_, i) => ({ patient_id: patientId, resp, ref: `${nome} · Plano (${i + 1}/${n})`, venc: `05/${String(8 + i).padStart(2, '0')}/2026`, val: brMoney(parcela), status: 'aberto' }))
      supabase.from('installments').insert(rows).then(({ error }) => { if (error) console.error('[supabase] installments', error.message) })
    }
    toast('Plano aprovado — parcelas geradas.')
  }

  // opções do seletor: tabela de preços (Ficha de Procedimento); escolher preenche o valor
  const procOpts = procedimentos.map((p) => ({ value: p.proc, sub: `${p.cat || 'Geral'}${p.val ? ` · ${brMoney(p.val)}` : ''}` }))
  const pickProc = (name: string) => {
    const p = procedimentos.find((x) => x.proc === name)
    setForm((f) => ({ ...f, proc: name, val: p && p.val ? String(p.val).replace('.', ',') : f.val }))
  }

  const addItem = () => {
    if (!form.proc.trim()) return toast('Informe o procedimento.', 'error')
    if (est) add({ dente: '', face: '', regiao: form.regiao || '—', proc: form.proc, qtd: form.qtd || '—', val: parseMoney(form.val) })
    else add({ dente: form.dente || '—', face: form.face || '—', regiao: '', proc: form.proc, qtd: '', val: parseMoney(form.val) })
    setForm({ dente: '', face: '', regiao: '', proc: '', qtd: '', val: '' })
    setAddOpen(false)
    toast('Item adicionado ao plano.')
  }

  const sendWhats = () => { setSending(true); setTimeout(() => { setSending(false); toast('Orçamento enviado por WhatsApp.') }, 700) }
  const genPdf = () => setPrinting(true)

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 22, alignContent: 'start' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ font: "800 16px 'Plus Jakarta Sans'", color: '#26324a' }}>Plano de tratamento</span>
            <span style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>{items.length} itens</span>
          </div>
          <span style={{ padding: '5px 12px', borderRadius: 20, font: "700 11.5px 'Plus Jakarta Sans'", ...(approved ? { background: '#e7f5ec', color: '#127436' } : { background: '#fdf1e2', color: '#9a5a06' }) }}>
            {approved ? 'Aprovado' : 'Aguardando aprovação'}
          </span>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-head" style={{ gridTemplateColumns: est ? GRID_EST : GRID }}>
            {est ? <><span>REGIÃO FACIAL</span><span>PROCEDIMENTO</span><span style={{ textAlign: 'right' }}>UNID./QTD</span></> : <><span>DENTE</span><span>FACE</span><span>PROCEDIMENTO</span></>}
            <span style={{ textAlign: 'right' }}>VALOR</span><span />
          </div>
          {items.map((r) => (
            <div key={r.id} className="table-row" style={{ gridTemplateColumns: est ? GRID_EST : GRID }}>
              {est ? (
                <>
                  <span style={{ font: "800 12.5px 'Plus Jakarta Sans'", color: '#c2478a' }}>{r.regiao}</span>
                  <span style={{ font: "600 13px 'Plus Jakarta Sans'", color: '#26324a' }}>{r.proc}</span>
                  <span className="tnum" style={{ font: "700 12px 'JetBrains Mono'", color: '#5b647a', textAlign: 'right' }}>{r.qtd}</span>
                </>
              ) : (
                <>
                  <span style={{ font: "800 12.5px 'JetBrains Mono'", color: '#2f52e0' }}>{r.dente}</span>
                  <span style={{ font: "700 12px 'JetBrains Mono'", color: '#5b647a' }}>{r.face}</span>
                  <span style={{ font: "600 13px 'Plus Jakarta Sans'", color: '#26324a' }}>{r.proc}</span>
                </>
              )}
              <span className="tnum" style={{ font: "700 13px 'Plus Jakarta Sans'", color: '#26324a', textAlign: 'right' }}>{brMoney(r.val)}</span>
              <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Menu items={[{ label: 'Excluir', danger: true, onClick: () => { remove(r.id); toast('Item removido.') } }]} />
              </span>
            </div>
          ))}
          <button onClick={() => setAddOpen(true)} style={{ width: '100%', textAlign: 'left', padding: '13px 18px', font: "700 12.5px 'Plus Jakarta Sans'", color: '#2f52e0', cursor: 'pointer', background: 'transparent', border: 'none' }}>
            + Adicionar {est ? 'região' : 'procedimento'}
          </button>
        </div>

        <div className="card card-hover" style={{ padding: '16px 20px', marginTop: 16, maxWidth: 340, marginLeft: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', font: "600 12.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>
            <span>Subtotal</span><span className="tnum" style={{ color: '#26324a' }}>{brMoney(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', font: "600 12.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>
            <span>Desconto (R$)</span>
            <input className="field-input" type="number" value={discount} onChange={(e) => { const v = Number(e.target.value) || 0; setDiscount(v); savePlan({ discount: v }) }} style={{ width: 100, height: 30, textAlign: 'right' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', marginTop: 6, borderTop: '1px solid #eef1f1', font: "800 16px 'Plus Jakarta Sans'", color: '#26324a' }}>
            <span>Total</span><span className="tnum">{brMoney(total)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card card-hover" style={{ padding: '16px 18px' }}>
          <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 10 }}>Aprovação do responsável</div>
          <Button variant="whats" block loading={sending} onClick={sendWhats} style={{ marginBottom: 8 }}>Enviar por WhatsApp</Button>
          <Button variant="teal-soft" block disabled={approved} onClick={aprovar}>
            {approved ? 'Plano aprovado ✓' : 'Marcar como aprovado'}
          </Button>
        </div>

        <div className="card card-hover" style={{ padding: '16px 18px' }}>
          <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 10 }}>Parcelamento</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[3, 2, 1].map((n) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', border: '1px solid #e5e9f2', borderRadius: 11 }}>
                <span style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{n === 1 ? 'À vista (Pix)' : `${n}x sem juros`}</span>
                <span className="tnum" style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#2f52e0' }}>{brMoney((n === 1 ? total * 0.95 : total) / n)}</span>
              </div>
            ))}
          </div>
        </div>

        <Button block onClick={genPdf} style={{ height: 44 }}>Gerar PDF do orçamento</Button>
      </div>

      <PrintDoc open={printing} title="Orçamento de tratamento" onClose={() => setPrinting(false)}>
        <div className="doc-field" style={{ marginBottom: 4 }}><span className="doc-field-label">Paciente:</span><span className="doc-field-value">{patient?.name ?? ''}</span></div>
        <div className="doc-field" style={{ marginBottom: 12 }}><span className="doc-field-label">Data:</span><span className="doc-field-value">{new Date().toLocaleDateString('pt-BR')}</span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid #2b2b2b', textAlign: 'left' }}>
              {est ? <><th style={{ padding: '6px 4px' }}>Região</th><th>Procedimento</th><th>Qtd</th></> : <><th style={{ padding: '6px 4px' }}>Dente</th><th>Face</th><th>Procedimento</th></>}
              <th style={{ textAlign: 'right' }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} style={{ borderBottom: '1px solid #ddd' }}>
                {est ? <><td style={{ padding: '6px 4px' }}>{it.regiao || '—'}</td><td>{it.proc}</td><td>{it.qtd || '—'}</td></> : <><td style={{ padding: '6px 4px' }}>{it.dente || '—'}</td><td>{it.face || '—'}</td><td>{it.proc}</td></>}
                <td style={{ textAlign: 'right' }}>{brMoney(it.val)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 14, marginLeft: 'auto', width: 240, fontSize: 12.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span>Subtotal</span><span>{brMoney(subtotal)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span>Desconto</span><span>− {brMoney(discount)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: 4, borderTop: '1.5px solid #2b2b2b', fontWeight: 800, fontSize: 14 }}><span>Total</span><span>{brMoney(total)}</span></div>
        </div>
        <div style={{ marginTop: 18, fontSize: 11.5, color: '#555' }}>
          Formas de pagamento: à vista no Pix com 5% de desconto ({brMoney(total * 0.95)}), ou em até 3x sem juros de {brMoney(total / 3)}.
          Orçamento válido por 30 dias. Valores sujeitos a reavaliação clínica.
        </div>
      </PrintDoc>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={est ? 'Adicionar região' : 'Adicionar procedimento'} width={420}
        footer={<><Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button><Button onClick={addItem}>Adicionar</Button></>}>
        {est ? (
          <>
            <Field label="Região facial"><TextInput autoFocus value={form.regiao} onChange={(e) => setForm({ ...form, regiao: e.target.value })} placeholder="Ex.: Testa" /></Field>
            <Field label="Procedimento"><SuggestInput value={form.proc} options={procOpts} placeholder="Ex.: Toxina botulínica" emptyText="Fora da tabela — será um procedimento avulso." onChange={(v) => setForm({ ...form, proc: v })} onPick={pickProc} /></Field>
            <FieldRow>
              <Field label="Unid./Qtd"><TextInput value={form.qtd} onChange={(e) => setForm({ ...form, qtd: e.target.value })} placeholder="Ex.: 10U" /></Field>
              <Field label="Valor (R$)"><TextInput inputMode="decimal" value={form.val} onChange={(e) => setForm({ ...form, val: e.target.value })} placeholder="350,00" /></Field>
            </FieldRow>
          </>
        ) : (
          <>
            <FieldRow>
              <Field label="Dente"><TextInput autoFocus value={form.dente} onChange={(e) => setForm({ ...form, dente: e.target.value })} placeholder="Ex.: 64" /></Field>
              <Field label="Face"><TextInput value={form.face} onChange={(e) => setForm({ ...form, face: e.target.value })} placeholder="Ex.: O" /></Field>
            </FieldRow>
            <Field label="Procedimento"><SuggestInput value={form.proc} options={procOpts} placeholder="Ex.: Restauração em resina" emptyText="Fora da tabela — será um procedimento avulso." onChange={(v) => setForm({ ...form, proc: v })} onPick={pickProc} /></Field>
            <Field label="Valor (R$)"><TextInput inputMode="decimal" value={form.val} onChange={(e) => setForm({ ...form, val: e.target.value })} placeholder="180,00" /></Field>
          </>
        )}
      </Modal>
    </div>
  )
}
