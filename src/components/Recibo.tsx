import { Modal } from './Modal'
import { Button } from './Button'
import { Field, TextInput } from './Field'
import { DateField } from './DateField'
import { maskCpf } from '../lib/masks'
import { brMoney, parseMoney, extenso } from '../lib/money'
import { brDate } from '../lib/dates'
import { BRAND } from '../brand'
import type { Recibo, ReciboOrigem } from '../lib/recibos'
import type { ClinicInfo } from '../lib/clinic'

export type { ClinicInfo }

/** Rascunho editável antes de emitir (valor como texto para digitação). */
export interface ReciboDraft {
  payerName: string
  payerCpf: string
  description: string
  value: string
  issuedOn: string
  origin: ReciboOrigem
  refId?: string
  patientId?: string
}

/**
 * Confirmação do recibo — abre quando o paciente/responsável pede.
 * O CPF é opcional para imprimir, mas é o que o Carnê-Leão pede: avisamos.
 */
export function ReciboModal({ open, draft, onChange, onClose, onEmit, saving }: {
  open: boolean
  draft: ReciboDraft | null
  onChange: (d: ReciboDraft) => void
  onClose: () => void
  onEmit: () => void
  saving?: boolean
}) {
  const valor = parseMoney(draft?.value ?? '')
  return (
    <Modal
      open={open && !!draft}
      onClose={onClose}
      title="Emitir recibo"
      subtitle="Para o paciente que pede comprovante do pagamento"
      width={460}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Não precisa</Button>
          <Button loading={saving} onClick={onEmit}>Emitir e imprimir</Button>
        </>
      }
    >
      {draft && (
        <>
          <Field label="Pagador (quem consta no recibo)">
            <TextInput autoFocus value={draft.payerName} onChange={(e) => onChange({ ...draft, payerName: e.target.value })} placeholder="Nome do responsável ou paciente" />
          </Field>
          <div className="field-row">
            <Field label="CPF do pagador">
              <TextInput inputMode="numeric" value={draft.payerCpf} onChange={(e) => onChange({ ...draft, payerCpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" />
            </Field>
            <Field label="Data de emissão">
              <DateField value={draft.issuedOn} onChange={(iso) => onChange({ ...draft, issuedOn: iso })} />
            </Field>
          </div>
          <Field label="Referente a">
            <TextInput value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} placeholder="Ex.: Tratamento odontológico — restauração" />
          </Field>
          <Field label="Valor (R$)">
            <TextInput inputMode="decimal" value={draft.value} onChange={(e) => onChange({ ...draft, value: e.target.value })} placeholder="0,00" />
          </Field>
          <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: valor ? '#5b647a' : '#a81e1e' }}>
            {valor ? `${brMoney(valor)} — ${extenso(valor)}.` : 'Informe um valor maior que zero.'}
          </div>
          {!draft.payerCpf.trim() && (
            <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#9a5a06', background: '#fdf1e2', padding: '9px 11px', borderRadius: 10 }}>
              Sem CPF o recibo imprime normalmente, mas o lançamento não fica completo para o Carnê-Leão.
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

/** Corpo imprimível do recibo (vai dentro de <PrintDoc>). */
export function ReciboDoc({ recibo, clinic }: { recibo: Recibo; clinic: ClinicInfo }) {
  const emissor = [clinic.cro, clinic.cnpj ? `CNPJ ${clinic.cnpj}` : '', clinic.cpf ? `CPF ${clinic.cpf}` : '', clinic.address]
    .filter(Boolean)
    .join(' · ')
  return (
    <div style={{ font: "500 13px/1.8 'Plus Jakarta Sans'", color: '#1c2430' }}>
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <div style={{ font: "800 18px 'Plus Jakarta Sans'" }}>{clinic.name}</div>
        <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#5b647a' }}>{emissor}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #1c2430', borderBottom: '2px solid #1c2430', padding: '10px 2px', marginBottom: 22 }}>
        <span style={{ font: "800 16px 'Plus Jakarta Sans'", letterSpacing: 1 }}>
          RECIBO <span style={{ fontSize: 13, fontWeight: 700, color: '#5b647a' }}>Nº {String(recibo.number).padStart(4, '0')}</span>
        </span>
        <span className="tnum" style={{ font: "800 16px 'Plus Jakarta Sans'" }}>{brMoney(recibo.value)}</span>
      </div>

      <p style={{ margin: '0 0 16px' }}>
        Recebi de <b>{recibo.payerName}</b>
        {recibo.payerCpf ? <>, CPF <b>{recibo.payerCpf}</b>,</> : ','}{' '}
        a importância de <b>{brMoney(recibo.value)}</b> ({extenso(recibo.value)}), referente a{' '}
        <b>{recibo.description || 'serviços odontológicos'}</b>, pela qual dou plena e geral quitação.
      </p>

      <p style={{ margin: '0 0 44px' }}>
        {BRAND.city}, {brDate(recibo.issuedOn)}.
      </p>

      <div style={{ width: 300, margin: '0 auto', textAlign: 'center', borderTop: '1px solid #1c2430', paddingTop: 8 }}>
        <div style={{ font: "700 13px 'Plus Jakarta Sans'" }}>{BRAND.dentist}</div>
        <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>
          {BRAND.role}{clinic.cpf ? ` · CPF ${clinic.cpf}` : ''}
        </div>
      </div>

      <div style={{ marginTop: 30, font: "500 10.5px 'Plus Jakarta Sans'", color: '#7c869a', textAlign: 'center' }}>
        Documento emitido eletronicamente pelo GL CRM · recibo nº {String(recibo.number).padStart(4, '0')}
      </div>
    </div>
  )
}
