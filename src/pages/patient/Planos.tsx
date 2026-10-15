import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Field, TextInput, FieldRow } from '../../components/Field'
import { useToast } from '../../components/Toast'
import { useCollection, usePatientId } from '../../lib/useCollection'
import { SuggestInput } from '../../components/SuggestInput'
import { DateField } from '../../components/DateField'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store'
import { PrintDoc } from '../../components/PrintDoc'
import { Icon } from '../../icons'
import { brDate, addMonths, primeiroVencimento } from '../../lib/dates'
import { parseMoney, brMoney, dividirParcelas } from '../../lib/money'
import { waLink, contactPhone, contactName } from '../../lib/whats'
import { planoItens, planoEstetico, isSeedPatient, type Perfil } from '../../data'

/** Desconto do pagamento à vista no Pix (mesma regra do orçamento impresso). */
const DESC_AVISTA = 0.05
const PARCELAS = [1, 2, 3]

interface Item { id: string; dente: string; face: string; regiao: string; proc: string; qtd: string; val: number }

const seedPed: Item[] = planoItens.map((r, i) => ({ id: `seed-p${i}`, dente: r.dente, face: r.face, regiao: '', proc: r.proc, qtd: '', val: parseMoney(r.val) }))
const seedEst: Item[] = planoEstetico.map((r, i) => ({ id: `seed-e${i}`, dente: '', face: '', regiao: r.regiao, proc: r.proc, qtd: r.qtd, val: parseMoney(r.val) }))

const fmtValor = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Planos({ perfil }: { perfil?: Perfil }) {
  const est = perfil === 'estetico'
  const { toast } = useToast()
  const patientId = usePatientId()
  const { id: idRota } = useParams()
  const { patients, procedimentos } = useStore()
  // pelo id quando há banco; pelo nome da rota no modo demonstração (sem _id o PDF saía sem nome)
  const nomeRota = idRota ? decodeURIComponent(idRota) : ''
  const patient = patients.find((p) => (p as { _id?: string })._id === patientId && patientId) ?? patients.find((p) => p.name === nomeRota)
  const { rows: items, add, remove } = useCollection<Item>(
    'plan_items',
    patientId,
    (r) => ({ id: r.id as string, dente: (r.dente as string) ?? '', face: (r.face as string) ?? '', regiao: (r.regiao as string) ?? '', proc: (r.proc as string) ?? '', qtd: (r.qtd as string) ?? '', val: Number(r.val) || 0 }),
    (it) => ({ dente: it.dente, face: it.face, regiao: it.regiao, proc: it.proc, qtd: it.qtd, val: it.val }),
    isSeedPatient(patient?.name) ? (est ? seedEst : seedPed) : [], // plano demo só nos pacientes de demonstração
  )
  const [approved, setApproved] = useState(false)
  const [discount, setDiscount] = useState(isSeedPatient(patient?.name) ? (est ? 150 : 40) : 0)
  // o campo guarda o texto digitado; o desconto só vale (e só grava) ao sair do campo
  const [discountTxt, setDiscountTxt] = useState(() => fmtValor(isSeedPatient(patient?.name) ? (est ? 150 : 40) : 0))
  const [parcelas, setParcelas] = useState(3)
  const [venc1, setVenc1] = useState(() => primeiroVencimento())
  const [printing, setPrinting] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [confirmAprovar, setConfirmAprovar] = useState(false)
  const [removendo, setRemovendo] = useState<Item | null>(null)
  const [form, setForm] = useState({ dente: '', face: '', regiao: '', proc: '', qtd: '', val: '' })

  // status/desconto do plano (persistido em plans)
  useEffect(() => {
    if (!supabase || !patientId) return
    let cancelled = false
    supabase.from('plans').select('status,discount').eq('patient_id', patientId).maybeSingle().then(({ data, error }) => {
      if (cancelled || error || !data) return
      setApproved(data.status === 'aprovado')
      if (typeof data.discount === 'number') { setDiscount(data.discount); setDiscountTxt(fmtValor(data.discount)) }
    })
    return () => { cancelled = true }
  }, [patientId])

  const savePlan = (patch: { status?: string; discount?: number }) => {
    if (supabase && patientId) {
      supabase.from('plans').upsert({ patient_id: patientId, status: patch.status ?? (approved ? 'aprovado' : 'aguardando'), discount: patch.discount ?? discount }, { onConflict: 'patient_id' })
        .then(({ error }) => { if (error) toast('Não foi possível salvar o plano. Verifique a conexão.', 'error') })
    }
  }

  const subtotal = items.reduce((s, it) => s + it.val, 0)
  const total = Math.max(0, subtotal - discount)

  /** Desconto entre R$ 0,00 e o subtotal; grava uma vez, ao sair do campo. */
  const confirmarDesconto = () => {
    const bruto = parseMoney(discountTxt)
    const v = Math.min(Math.max(0, bruto), subtotal)
    if (bruto < 0) toast('O desconto não pode ser negativo.', 'error')
    else if (bruto > subtotal) toast('O desconto foi limitado ao subtotal.', 'info')
    setDiscountTxt(fmtValor(v))
    if (v !== discount) { setDiscount(v); savePlan({ discount: v }) }
  }

  /** Total cobrado na condição escolhida — à vista no Pix leva o desconto. */
  const totalEm = (n: number) => (n === 1 ? Math.round(total * (1 - DESC_AVISTA) * 100) / 100 : total)
  const valores = dividirParcelas(totalEm(parcelas), parcelas)

  const pedirAprovacao = () => {
    if (items.length === 0) return toast('Adicione itens ao plano antes de aprovar.', 'error')
    // o DateField devolve '' quando o campo é apagado — sem data não dá para gerar carnê
    if (!venc1) return toast('Informe a data do vencimento.', 'error')
    setConfirmAprovar(true)
  }

  const aprovar = () => {
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
      supabase.from('installments').insert(rows).then(({ error }) => { if (error) toast('O plano foi aprovado, mas as parcelas não foram geradas. Confira no Financeiro.', 'error') })
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
    if (parseMoney(form.val) < 0) return toast('O valor não pode ser negativo.', 'error')
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

  const rotuloParcela = (n: number) => (n === 1 ? 'À vista no PIX' : `${n} parcelas`)

  return (
    <div className="tab-body">
      <div className="home-cols">
        <section className="panel flush home-main" aria-labelledby="plano-titulo">
          <div className="panel-head">
            <div>
              <h2 id="plano-titulo" className="panel-title">
                Plano de tratamento
                <span className={`tag ${approved ? 'tag-ok' : 'tag-warn'}`} style={{ minWidth: 0, padding: '3px 9px', borderRadius: 999 }}>{approved ? 'Aprovado' : 'Aguardando aprovação'}</span>
              </h2>
              <p className="panel-sub">{items.length} {items.length === 1 ? 'item' : 'itens'}{approved ? ' · itens travados após a aprovação' : ''}</p>
            </div>
            {!approved && <button className="btn-soft" onClick={() => setAddOpen(true)}>+ Adicionar {est ? 'região' : 'procedimento'}</button>}
          </div>

          <div className="qtable">
            <div style={{ minWidth: 480 }} role="table" aria-label="Itens do plano">
              <div className={`plan-row head${est ? ' est' : ''}`} role="row">
                {est
                  ? <><span role="columnheader">Região</span><span role="columnheader">Procedimento</span><span role="columnheader" className="num">Qtd.</span></>
                  : <><span role="columnheader">Dente · face</span><span role="columnheader">Procedimento</span></>}
                <span role="columnheader" className="num">Valor</span><span role="columnheader"><span className="visually-hidden">Remover</span></span>
              </div>
              {items.length === 0 && <p className="qempty">Nenhum item ainda. Adicione os procedimentos do tratamento.</p>}
              {items.map((r) => (
                <div key={r.id} className={`plan-row${est ? ' est' : ''}`} role="row">
                  {est ? (
                    <>
                      <span role="cell" className="q-main" style={{ color: '#8e2a62' }}>{r.regiao}</span>
                      <span role="cell" className="q-main">{r.proc}</span>
                      <span role="cell" className="num cell-sub" style={{ color: 'var(--slate)' }}>{r.qtd}</span>
                    </>
                  ) : (
                    <>
                      <span role="cell"><span className="q-main tnum">{r.dente}</span>{r.face && r.face !== '—' && <span className="q-sub">face {r.face}</span>}</span>
                      <span role="cell" className="q-main">{r.proc}</span>
                    </>
                  )}
                  <span role="cell" className="num q-main">{brMoney(r.val)}</span>
                  <span role="cell" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {!approved && (
                      <button className="nav-arrow" style={{ width: 30, height: 30, border: 'none', background: 'transparent' }} aria-label={`Remover ${r.proc}`} title="Remover" onClick={() => setRemovendo(r)}>
                        <Icon name="trash" size={16} />
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="plan-foot">
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, font: '600 12px var(--font)', color: 'var(--text-2)' }}>
              Desconto
              <span className="money-field">
                <span>R$</span>
                <input inputMode="decimal" value={discountTxt} disabled={approved} aria-describedby="desc-ajuda"
                  onChange={(e) => setDiscountTxt(e.target.value)} onBlur={confirmarDesconto}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
              </span>
              <span id="desc-ajuda" style={{ font: '400 11.5px var(--font)', color: 'var(--muted)' }}>entre R$ 0,00 e o subtotal</span>
            </label>
            <div className="totals">
              <span>Subtotal</span><span>{brMoney(subtotal)}</span>
              <span>Desconto</span><span style={{ color: discount ? 'var(--danger-text)' : undefined }}>{discount ? `− ${brMoney(discount)}` : brMoney(0)}</span>
              <span className="total">Total</span><span className="total">{brMoney(total)}</span>
            </div>
          </div>
        </section>

        <aside className="home-aside" aria-label="Pagamento e aprovação">
          <section className="panel">
            <h2 className="panel-title sm">Forma de pagamento</h2>
            <div role="radiogroup" aria-label="Parcelamento" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {PARCELAS.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={n === parcelas} className="pay-option" disabled={approved} onClick={() => setParcelas(n)}>
                  <span className="pay-radio" aria-hidden="true" />
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', font: `${n === parcelas ? 600 : 500} 13px var(--font)`, color: 'var(--ink)' }}>{rotuloParcela(n)}</span>
                    {n === 1 && <span style={{ display: 'block', font: '400 11.5px var(--font)', color: 'var(--green-dark)' }}>5% de desconto</span>}
                  </span>
                  <span className="tnum" style={{ font: '600 13px var(--font)', color: 'var(--ink)' }}>
                    {n === 1 ? brMoney(totalEm(1)) : `${n} × ${brMoney(dividirParcelas(totalEm(n), n)[0])}`}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ font: '600 12px var(--font)', color: 'var(--text-2)', marginBottom: 6 }}>{parcelas === 1 ? 'Vencimento' : '1º vencimento'}</div>
              <DateField value={venc1} onChange={setVenc1} />
              <div style={{ font: '400 11.5px var(--font)', color: 'var(--muted)', marginTop: 6 }}>sugestão: dia 5 do mês seguinte</div>
            </div>
            {venc1 && total > 0 && (
              <div className="carne" aria-label="Carnê">
                <div style={{ font: '600 11.5px var(--font)', color: 'var(--muted)' }}>{approved ? 'Carnê gerado' : 'Carnê gerado ao aprovar'}</div>
                {valores.map((v, i) => (
                  <div key={i} className="carne-row"><span>{brDate(addMonths(venc1, i))}</span><span>{brMoney(v)}</span></div>
                ))}
              </div>
            )}
          </section>

          <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn-cta" style={{ height: 44, width: '100%' }} disabled={approved} onClick={pedirAprovacao}>
              {approved ? <><Icon name="check" size={16} /> Plano aprovado</> : 'Aprovar plano…'}
            </button>
            <p style={{ margin: '0 0 4px', font: '400 11.5px var(--font)', color: 'var(--muted)', textAlign: 'center' }}>
              {approved ? 'As parcelas estão no Financeiro.' : 'Pede confirmação, gera o carnê e trava os itens.'}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-soft" style={{ flex: 1, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={sendWhats}><Icon name="wa" size={15} /> Enviar por WhatsApp</button>
              <button className="btn-soft" style={{ flex: 1, height: 40 }} onClick={() => setPrinting(true)}>Gerar PDF</button>
            </div>
          </section>
        </aside>
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
        <div style={{ marginTop: 18, fontSize: 11.5, color: 'var(--slate)' }}>
          Formas de pagamento: à vista no Pix com 5% de desconto ({brMoney(totalEm(1))}), ou em até 3x sem juros de {brMoney(dividirParcelas(total, 3)[0])}.
          Orçamento válido por 30 dias. Valores sujeitos a reavaliação clínica.
        </div>
      </PrintDoc>

      <ConfirmDialog open={confirmAprovar} onClose={() => setConfirmAprovar(false)} onConfirm={aprovar} danger={false} confirmLabel="Aprovar plano"
        title="Aprovar plano de tratamento"
        message={`${parcelas === 1 ? `Será gerada 1 cobrança de ${brMoney(valores[0])} para ${brDate(venc1)}` : `Serão geradas ${parcelas} parcelas de ${brMoney(valores[0])} a partir de ${brDate(venc1)}`} no Financeiro${patient ? `, em nome de ${patient.resp && patient.resp !== '—' ? patient.resp.split('·')[0].trim() : patient.name}` : ''}. Depois de aprovado, os itens do plano ficam travados.`} />

      <ConfirmDialog open={!!removendo} onClose={() => setRemovendo(null)} onConfirm={() => { if (removendo) { remove(removendo.id); toast('Item removido.') } }}
        title="Remover item do plano" message={`Remover "${removendo?.proc ?? ''}" (${brMoney(removendo?.val ?? 0)}) do plano?`} confirmLabel="Remover" />

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
