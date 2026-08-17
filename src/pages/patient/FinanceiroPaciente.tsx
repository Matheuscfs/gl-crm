import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Menu } from '../../components/Menu'
import { Button } from '../../components/Button'
import { useToast } from '../../components/Toast'
import { useCollection, usePatientId } from '../../lib/useCollection'
import { PrintDoc } from '../../components/PrintDoc'
import { ReciboModal, ReciboDoc, type ReciboDraft } from '../../components/Recibo'
import { listRecibos, createRecibo, type Recibo } from '../../lib/recibos'
import { useClinic } from '../../lib/clinic'
import { CountUp } from '../../components/ui'
import { useStore } from '../../store'
import { todayISO } from '../../lib/dates'
import { parseMoney as toNumber } from '../../lib/money'
import { PARCELA_STATUS, isSeedPatient, type ParcelaStatus } from '../../data'

const GRID = '2fr 1fr 1fr 1fr 34px'
interface Row {
  id: string
  ref: string
  venc: string
  val: string
  status: ParcelaStatus
}
const SEED: Row[] = [
  { id: 'seed-p1', ref: 'Plano #218 (1/3)', venc: '05/07/2026', val: 'R$ 200,00', status: 'pago' },
  { id: 'seed-p2', ref: 'Plano #218 (2/3)', venc: '05/08/2026', val: 'R$ 200,00', status: 'aberto' },
  { id: 'seed-p3', ref: 'Plano #218 (3/3)', venc: '05/09/2026', val: 'R$ 200,00', status: 'aberto' },
]

export default function FinanceiroPaciente() {
  const { toast } = useToast()
  const patientId = usePatientId()
  const { id } = useParams()
  const patientName = id ? decodeURIComponent(id) : 'Paciente'
  // parcelas demo só para pacientes de demonstração — cadastro novo começa zerado
  const { rows, save } = useCollection<Row>(
    'installments',
    patientId,
    (r) => ({ id: r.id as string, ref: (r.ref as string) ?? '', venc: (r.venc as string) ?? '', val: (r.val as string) ?? '', status: (r.status as ParcelaStatus) ?? 'aberto' }),
    (item) => ({ ref: item.ref, venc: item.venc, val: item.val, status: item.status }),
    isSeedPatient(patientName) ? SEED : [],
  )
  const { patients } = useStore()
  const clinic = useClinic()
  // recibo numerado e registrado (mesmo fluxo do Financeiro → entra no Carnê-Leão)
  const [draft, setDraft] = useState<ReciboDraft | null>(null)
  const [emitindo, setEmitindo] = useState(false)
  const [recibo, setRecibo] = useState<Recibo | null>(null)
  const [ultimo, setUltimo] = useState(0)
  useEffect(() => { listRecibos().then((rs) => setUltimo(rs.reduce((m, r) => Math.max(m, r.number), 0))) }, [])

  const parseMoney = (s: string) => Number(String(s).replace(/[^\d,]/g, '').replace(',', '.')) || 0
  const brMoney = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const total = rows.reduce((s, r) => s + parseMoney(r.val), 0)
  const pago = rows.filter((r) => r.status === 'pago').reduce((s, r) => s + parseMoney(r.val), 0)

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
    const value = toNumber(draft.value)
    if (!draft.payerName.trim() || !value) return toast('Informe pagador e valor.', 'error')
    setEmitindo(true)
    const novo = await createRecibo({ ...draft, payerName: draft.payerName.trim(), value }, ultimo)
    setEmitindo(false)
    setUltimo(novo.number)
    setDraft(null)
    setRecibo(novo)
    toast(`Recibo nº ${String(novo.number).padStart(4, '0')} emitido.`)
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <div className="card card-hover" style={{ padding: '16px 18px' }}>
          <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Total</div>
          <div className="tnum" style={{ font: "800 22px 'Plus Jakarta Sans'", color: '#26324a', marginTop: 6 }}><CountUp value={brMoney(total)} /></div>
        </div>
        <div className="card card-hover" style={{ padding: '16px 18px' }}>
          <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Pago</div>
          <div className="tnum" style={{ font: "800 22px 'Plus Jakarta Sans'", color: '#2f9a5b', marginTop: 6 }}><CountUp value={brMoney(pago)} /></div>
        </div>
        <div className="card card-hover" style={{ padding: '16px 18px' }}>
          <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Em aberto</div>
          <div className="tnum" style={{ font: "800 22px 'Plus Jakarta Sans'", color: '#d97706', marginTop: 6 }}><CountUp value={brMoney(total - pago)} /></div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 12px', font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', borderBottom: '1px solid #eff2f8' }}>Parcelas</div>
        <div className="table-head" style={{ gridTemplateColumns: GRID, padding: '10px 20px' }}>
          <span>REFERÊNCIA</span><span>VENCIMENTO</span><span style={{ textAlign: 'right' }}>VALOR</span><span style={{ textAlign: 'right' }}>STATUS</span><span />
        </div>
        {rows.map((r) => {
          const st = PARCELA_STATUS[r.status]
          return (
            <div key={r.id} className="table-row" style={{ gridTemplateColumns: GRID, padding: '12px 20px' }}>
              <span style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{r.ref}</span>
              <span className="tnum" style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>{r.venc}</span>
              <span className="tnum" style={{ font: "700 13px 'Plus Jakarta Sans'", color: '#26324a', textAlign: 'right' }}>{r.val}</span>
              <span style={{ textAlign: 'right' }}><span className="pill" style={{ background: st.bg, color: st.fg }}>{st.label}</span></span>
              <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Menu items={[
                  { label: 'Marcar como pago', disabled: r.status === 'pago', onClick: () => { save({ ...r, status: 'pago' }); toast('Parcela paga.') } },
                  { label: 'Emitir recibo', disabled: r.status !== 'pago', onClick: () => emitirRecibo([r]) },
                  { label: 'Enviar cobrança', onClick: () => toast('Cobrança enviada.', 'info') },
                ]} />
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="outline" onClick={() => emitirRecibo(rows.filter((r) => r.status === 'pago'))}>Gerar recibo (parcelas pagas)</Button>
      </div>

      <ReciboModal open={!!draft} draft={draft} onChange={setDraft} onClose={() => setDraft(null)} onEmit={confirmarRecibo} saving={emitindo} />

      <PrintDoc open={!!recibo} title="Recibo" onClose={() => setRecibo(null)}>
        {recibo && <ReciboDoc recibo={recibo} clinic={clinic} />}
      </PrintDoc>
    </div>
  )
}
