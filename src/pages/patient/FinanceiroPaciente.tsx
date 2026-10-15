import { useEffect, useState } from 'react'
import { Menu } from '../../components/Menu'
import { useToast } from '../../components/Toast'
import { useCollection, usePatient } from '../../lib/useCollection'
import { PrintDoc } from '../../components/PrintDoc'
import { ReciboModal, ReciboDoc, type ReciboDraft } from '../../components/Recibo'
import { listRecibos, createRecibo, type Recibo } from '../../lib/recibos'
import { useClinic } from '../../lib/clinic'
import { useStore } from '../../store'
import { todayISO, addDays, brDate, isVencidaBr } from '../../lib/dates'
import { esquema } from '../../lib/sync'
import { parseMoney, brMoney } from '../../lib/money'
import { waLink, contactPhone, contactName } from '../../lib/whats'
import { type ParcelaStatus } from '../../data'

interface Row {
  id: string
  ref: string
  venc: string
  val: string
  status: ParcelaStatus
  /** Data do pagamento (ISO), quando pago. */
  pagoEm?: string
}
/** Vencimento a `dias` de hoje — a demonstração não envelhece com o calendário. */
const vencEm = (dias: number) => brDate(addDays(todayISO(), dias))
const SEED: Row[] = [
  { id: 'seed-p1', ref: 'Plano #218 (1/3)', venc: vencEm(-6), val: 'R$ 200,00', status: 'pago' },
  { id: 'seed-p2', ref: 'Plano #218 (2/3)', venc: vencEm(24), val: 'R$ 200,00', status: 'aberto' },
  { id: 'seed-p3', ref: 'Plano #218 (3/3)', venc: vencEm(54), val: 'R$ 200,00', status: 'aberto' },
]
const SITUACAO: Record<ParcelaStatus, { label: string; cls: string }> = {
  vencida: { label: 'Vencida', cls: 'danger' },
  aberto: { label: 'Em aberto', cls: 'warn' },
  pago: { label: 'Paga', cls: 'ok' },
}
/** "vencida" é derivado do vencimento — nada grava esse status no banco. */
const situacaoDe = (r: Row): ParcelaStatus => (r.status !== 'pago' && isVencidaBr(r.venc) ? 'vencida' : r.status)

export default function FinanceiroPaciente() {
  const { toast } = useToast()
  const { patient: atual, patientId, demo } = usePatient()
  const patientName = atual?.name ?? 'Paciente'
  // parcelas demo só para pacientes de demonstração — cadastro novo começa zerado
  const { rows, save } = useCollection<Row>(
    'installments',
    patientId,
    (r) => ({ id: r.id as string, ref: (r.ref as string) ?? '', venc: (r.venc as string) ?? '', val: (r.val as string) ?? '', status: (r.status as ParcelaStatus) ?? 'aberto', pagoEm: (r.pago_em as string) ?? undefined }),
    // data do pagamento (migração 0026): faturamento e recibo na data em que o dinheiro entrou
    (item) => ({ ref: item.ref, venc: item.venc, val: item.val, status: item.status, ...(esquema.v26 ? { pago_em: item.status === 'pago' ? (item.pagoEm ?? todayISO()) : null } : {}) }),
    demo ? SEED : [],
  )
  const { patients } = useStore()
  const clinic = useClinic()
  // recibo numerado e registrado (mesmo fluxo do Financeiro → entra no Carnê-Leão)
  const [draft, setDraft] = useState<ReciboDraft | null>(null)
  const [emitindo, setEmitindo] = useState(false)
  const [recibo, setRecibo] = useState<Recibo | null>(null)
  const [ultimo, setUltimo] = useState(0)
  useEffect(() => { listRecibos().then((rs) => setUltimo(rs.reduce((m, r) => Math.max(m, r.number), 0))) }, [])

  const total = rows.reduce((s, r) => s + parseMoney(r.val), 0)
  const pago = rows.filter((r) => r.status === 'pago').reduce((s, r) => s + parseMoney(r.val), 0)
  const vencidas = rows.filter((r) => situacaoDe(r) === 'vencida')
  const totalVencido = vencidas.reduce((s, r) => s + parseMoney(r.val), 0)

  const pac = patients.find((p) => p.name === patientName)
  const emitirRecibo = (items: Row[]) => {
    if (items.length === 0) return toast('Nenhuma parcela paga para gerar recibo.', 'error')
    const soma = items.reduce((s, r) => s + parseMoney(r.val), 0)
    setDraft({
      // pediátrico: quem paga (e recebe o recibo) é o responsável
      payerName: pac?.resp && pac.resp !== '—' ? pac.resp.split('·')[0].trim() : patientName,
      payerCpf: (pac?.respCpf?.trim() || pac?.cpf || '').trim(),
      description: `Tratamento odontológico — ${items.map((r) => r.ref).join(', ')}`,
      value: soma.toFixed(2).replace('.', ','),
      issuedOn: todayISO(),
      origin: 'parcela',
      refId: items.map((r) => r.id).join(','),
      patientId: patientId ?? undefined,
    })
  }

  const confirmarRecibo = async () => {
    if (!draft) return
    const value = parseMoney(draft.value)
    if (!draft.payerName.trim() || !value) return toast('Informe pagador e valor.', 'error')
    setEmitindo(true)
    const novo = await createRecibo({ ...draft, payerName: draft.payerName.trim(), value }, ultimo)
    setEmitindo(false)
    setUltimo(novo.number)
    setDraft(null)
    setRecibo(novo)
    toast(`Recibo nº ${String(novo.number).padStart(4, '0')} emitido.`)
  }

  /** Lembrete da parcela pelo WhatsApp de quem paga (o responsável, no pediátrico). */
  const cobrar = (r: Row) => {
    const quem = contactName(pac, patientName)
    const msg = `Oi, ${quem}! 😊 Passando para lembrar da parcela de ${brMoney(parseMoney(r.val))} (${r.ref}) com vencimento em ${r.venc}.\n\nQualquer dúvida, estamos à disposição! 🦷`
    const link = waLink(contactPhone(pac), msg)
    if (!link) return toast(`Sem telefone cadastrado para ${patientName}. Complete em Dados e responsáveis.`, 'error')
    window.open(link, '_blank', 'noopener')
    toast(`Cobrança aberta no WhatsApp para ${quem}.`)
  }

  return (
    <div className="tab-body">
      <div className="stack" style={{ gap: 16 }}>
        <section aria-label="Resumo" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div className="panel kpi-flat compact" style={{ flex: '1 1 96px' }}>
            <div className="l">Total</div>
            <div className="v">{brMoney(total)}</div>
            <div className="s">{rows.length} {rows.length === 1 ? 'parcela' : 'parcelas'}</div>
          </div>
          <div className="panel kpi-flat compact" style={{ flex: '1 1 96px' }}>
            <div className="l">Pago</div>
            <div className="v" style={{ color: 'var(--green-dark)' }}>{brMoney(pago)}</div>
            <div className="s">{(() => { const n = rows.filter((r) => r.status === 'pago').length; return `${n} ${n === 1 ? 'paga' : 'pagas'}` })()}</div>
          </div>
          <div className={`panel kpi-flat compact${totalVencido > 0 ? ' danger' : ''}`} style={{ flex: '1 1 96px' }}>
            <div className="l">Em aberto</div>
            <div className="v">{brMoney(total - pago)}</div>
            <div className="s">{vencidas.length ? `${brMoney(totalVencido)} vencidos` : 'nada vencido'}</div>
          </div>
        </section>

        <section className="panel flush" aria-labelledby="parcelas-titulo">
          <div className="panel-head">
            <h2 id="parcelas-titulo" className="panel-title">Parcelas</h2>
            <button className="btn-soft" onClick={() => emitirRecibo(rows.filter((r) => r.status === 'pago'))}>Recibo das parcelas pagas</button>
          </div>
          <div role="table" aria-label="Parcelas do paciente">
            <div className="pfin-row head" role="row">
              <span role="columnheader">Referência</span><span role="columnheader">Vencimento</span>
              <span role="columnheader" className="num">Valor</span><span role="columnheader" className="hide-sm">Situação</span>
              <span role="columnheader"><span className="visually-hidden">Ações</span></span>
            </div>
            {rows.length === 0 && <p className="qempty">Nenhuma parcela. Elas aparecem aqui quando um plano é aprovado.</p>}
            {rows.map((r) => {
              const st = SITUACAO[situacaoDe(r)]
              return (
                <div key={r.id} className="pfin-row" role="row">
                  <span className="q-text" role="cell">
                    <span className="q-main">{r.ref}</span>
                    <span className={`q-reason ${st.cls} show-sm`} style={{ marginTop: 2 }}>{st.label}</span>
                  </span>
                  <span className="cell-main" role="cell">{r.venc}</span>
                  <span className="num q-main" role="cell" style={{ fontWeight: 600 }}>{brMoney(parseMoney(r.val))}</span>
                  <span role="cell" className="hide-sm"><span className={`q-reason ${st.cls}`}>{st.label}</span></span>
                  <span role="cell" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Menu items={[
                      { label: 'Marcar como pago', disabled: r.status === 'pago', onClick: async () => { if (await save({ ...r, status: 'pago', pagoEm: todayISO() })) toast('Parcela marcada como paga.') } },
                      { label: 'Emitir recibo', disabled: r.status !== 'pago', onClick: () => emitirRecibo([r]) },
                      { label: 'Cobrar por WhatsApp', disabled: r.status === 'pago', onClick: () => cobrar(r) },
                    ]} />
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <ReciboModal open={!!draft} draft={draft} onChange={setDraft} onClose={() => setDraft(null)} onEmit={confirmarRecibo} saving={emitindo} />

      <PrintDoc open={!!recibo} title="Recibo" rodape={false} onClose={() => setRecibo(null)}>
        {recibo && <ReciboDoc recibo={recibo} clinic={clinic} />}
      </PrintDoc>
    </div>
  )
}
