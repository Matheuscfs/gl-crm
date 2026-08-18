import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Field, TextInput, FieldRow } from '../../components/Field'
import { Menu } from '../../components/Menu'
import { useToast } from '../../components/Toast'
import { useCollection, usePatientId } from '../../lib/useCollection'
import { SuggestInput } from '../../components/SuggestInput'
import { DateField } from '../../components/DateField'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store'
import { PrintDoc } from '../../components/PrintDoc'
import { brDate, addMonths, primeiroVencimento } from '../../lib/dates'
import { parseMoney, brMoney, dividirParcelas } from '../../lib/money'
import { waLink, contactPhone, contactName } from '../../lib/whats'
import { planoItens, planoEstetico, isSeedPatient, type Perfil } from '../../data'

const GRID = '0.7fr 0.7fr 3fr 1.1fr 34px'
const GRID_EST = '1.2fr 2.4fr 0.8fr 1.1fr 34px'
/** Desconto do pagamento à vista no Pix (mesma regra do orçamento impresso). */
const DESC_AVISTA = 0.05
const PARCELAS = [3, 2, 1]

interface Item { id: string; dente: string; face: string; regiao: string; proc: string; qtd: string; val: number }

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
  const [parcelas, setParcelas] = useState(3)
  const [venc1, setVenc1] = useState(() => primeiroVencimento())
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

  /** Total cobrado na condição escolhida — à vista no Pix leva o desconto. */
  const totalEm = (n: number) => (n === 1 ? Math.round(total * (1 - DESC_AVISTA) * 100) / 100 : total)
  const valores = dividirParcelas(totalEm(parcelas), parcelas)

  const aprovar = () => {
    // o DateField devolve '' quando o campo é apagado — sem data não dá para gerar carnê
    if (!venc1) return toast('Informe a data do vencimento.', 'error')
    setApproved(true)
    savePlan({ status: 'aprovado' })
    // gera as parcelas no financeiro (Fase 5 → 6)
    const gerou = Boolean(supabase && patientId && total > 0)
    if (supabase && patientId && total > 0) {
      const n = parcelas
      const nome = patient?.name ?? 'Paciente'
      const resp = patient?.resp && patient.resp !== '—' ? patient.resp : nome
      const rows = valores.map((val, i) => ({
        patient_id: patientId,
        resp,
        ref: n === 1 ? `${nome} · Plano (à vista)` : `${nome} · Plano (${i + 1}/${n})`,
        venc: brDate(addMonths(venc1, i)),
        val: brMoney(val),
        status: 'aberto',
      }))
      supabase.from('installments').insert(rows).then(({ error }) => { if (error) console.error('[supabase] installments', error.message) })
    }
    if (!gerou) return toast('Plano aprovado.')
    toast(parcelas === 1
      ? `Plano aprovado — cobrança de ${brMoney(valores[0])} para ${brDate(venc1)}.`
      : `Plano aprovado — ${parcelas} parcelas geradas a partir de ${brDate(venc1)}.`)
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

  /** Resumo do orçamento no corpo da mensagem (itens longos demais viram "+N itens"). */
  const orcamentoMsg = () => {
    const MAX = 12
    const linhas = items.slice(0, MAX).map((it) => `• ${it.proc}${est ? (it.qtd && it.qtd !== '—' ? ` (${it.qtd})` : '') : (it.dente && it.dente !== '—' ? ` — dente ${it.dente}` : '')} — ${brMoney(it.val)}`)
    if (items.length > MAX) linhas.push(`• …e mais ${items.length - MAX} ${items.length - MAX === 1 ? 'item' : 'itens'}`)
    const avista = totalEm(1)
    const tresX = dividirParcelas(total, 3)[0]
    return [
      `Oi, ${contactName(patient, '')}! 😊 Segue o orçamento do tratamento de ${patient?.name ?? ''}:`,
      '',
      ...linhas,
      '',
      ...(discount > 0 ? [`Desconto: − ${brMoney(discount)}`] : []),
      `*Total: ${brMoney(total)}*`,
      '',
      `Formas de pagamento: à vista no Pix por ${brMoney(avista)} (5% de desconto) ou em até 3x de ${brMoney(tresX)} sem juros.`,
      'Orçamento válido por 30 dias. Qualquer dúvida é só chamar! 🦷',
    ].join('\n')
  }

  const sendWhats = () => {
    if (items.length === 0) return toast('Adicione itens ao plano antes de enviar.', 'error')
    const link = waLink(contactPhone(patient), orcamentoMsg())
    if (!link) return toast('Sem telefone no cadastro deste paciente.', 'error')
    window.open(link, '_blank', 'noopener')
  }
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
          <Button variant="whats" block onClick={sendWhats} style={{ marginBottom: 8 }}>Enviar por WhatsApp</Button>
          <Button variant="teal-soft" block disabled={approved} onClick={aprovar}>
            {approved ? 'Plano aprovado ✓' : 'Marcar como aprovado'}
          </Button>
        </div>

        <div className="card card-hover" style={{ padding: '16px 18px' }}>
          <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 10 }}>Parcelamento</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {PARCELAS.map((n) => {
              const sel = n === parcelas
              return (
                <button key={n} onClick={() => setParcelas(n)} disabled={approved}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', textAlign: 'left', borderRadius: 11, cursor: approved ? 'default' : 'pointer', border: `1.5px solid ${sel ? '#3f6bf5' : '#e5e9f2'}`, background: sel ? '#f5f8ff' : '#fff', opacity: approved && !sel ? 0.5 : 1 }}>
                  <span style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{n === 1 ? 'À vista (Pix)' : `${n}x sem juros`}</span>
                  <span className="tnum" style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: sel ? '#2f52e0' : '#8b93a7' }}>{brMoney(dividirParcelas(totalEm(n), n)[0])}</span>
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ font: "700 11px 'Plus Jakarta Sans'", color: '#8b93a7', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {parcelas === 1 ? 'Vencimento' : '1º vencimento'}
            </div>
            <DateField value={venc1} onChange={setVenc1} />
            {parcelas > 1 && venc1 && (
              <div style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8b93a7', marginTop: 6 }}>
                Demais parcelas todo dia {Number(venc1.slice(8, 10))}, até {brDate(addMonths(venc1, parcelas - 1))}.
              </div>
            )}
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
          Formas de pagamento: à vista no Pix com 5% de desconto ({brMoney(totalEm(1))}), ou em até 3x sem juros de {brMoney(dividirParcelas(total, 3)[0])}.
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
