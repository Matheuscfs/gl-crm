import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Menu } from '../../components/Menu'
import { Button } from '../../components/Button'
import { useToast } from '../../components/Toast'
import { useCollection, usePatientId } from '../../lib/useCollection'
import { PrintDoc } from '../../components/PrintDoc'
import { CountUp } from '../../components/ui'
import { BRAND } from '../../brand'
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
  const [receipt, setReceipt] = useState<{ items: Row[]; total: number } | null>(null)

  const parseMoney = (s: string) => Number(String(s).replace(/[^\d,]/g, '').replace(',', '.')) || 0
  const brMoney = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const total = rows.reduce((s, r) => s + parseMoney(r.val), 0)
  const pago = rows.filter((r) => r.status === 'pago').reduce((s, r) => s + parseMoney(r.val), 0)
  const emitirRecibo = (items: Row[]) => {
    if (items.length === 0) return toast('Nenhuma parcela paga para gerar recibo.', 'error')
    setReceipt({ items, total: items.reduce((s, r) => s + parseMoney(r.val), 0) })
  }
  const extenso = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

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
                  { label: 'Gerar recibo', disabled: r.status !== 'pago', onClick: () => emitirRecibo([r]) },
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

      <PrintDoc open={!!receipt} title="Recibo de pagamento" onClose={() => setReceipt(null)}>
        {receipt && (
          <>
            <p className="doc-p" style={{ lineHeight: 1.8 }}>
              Recebi de <b>{patientName}</b> a importância de <b>R$ {extenso(receipt.total)}</b>, referente ao(s) pagamento(s) discriminado(s) abaixo, para maior clareza firmo o presente recibo.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1.5px solid #2b2b2b', textAlign: 'left' }}>
                  <th style={{ padding: '6px 4px' }}>Referência</th><th>Vencimento</th><th style={{ textAlign: 'right' }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '6px 4px' }}>{r.ref}</td><td>{r.venc}</td><td style={{ textAlign: 'right' }}>{r.val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', marginTop: 4, borderTop: '1.5px solid #2b2b2b', fontWeight: 800, fontSize: 14 }}>
              <span>Total recebido</span><span>{brMoney(receipt.total)}</span>
            </div>
            <div style={{ marginTop: 26, fontSize: 12 }}>{BRAND.city ?? 'Cascavel-PR'}, {new Date().toLocaleDateString('pt-BR')}.</div>
            <div style={{ marginTop: 40, textAlign: 'center', fontSize: 12 }}>
              _______________________________________________<br />
              <b>{BRAND.dentist}</b><br />{BRAND.role}
            </div>
          </>
        )}
      </PrintDoc>
    </div>
  )
}
