import type { ReactNode } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../icons'

const CIDADE = 'Cascavel-PR'

export function Butterfly({ size = 22, color = '#c2478a' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.1">
      <path d="M16 9c-1.5-4-5-6-8-5-2.8.9-3 4.5-1.5 7C8 13.5 12 14.5 16 15c-4 .5-8 1.5-9.5 4-1.5 2.5-1.3 6.1 1.5 7 3 1 6.5-1 8-5" fill={`${color}22`} />
      <path d="M16 9c1.5-4 5-6 8-5 2.8.9 3 4.5 1.5 7C24 13.5 20 14.5 16 15c4 .5 8 1.5 9.5 4 1.5 2.5 1.3 6.1-1.5 7-3 1-6.5-1-8-5" fill={`${color}22`} />
      <path d="M16 8v13" strokeWidth="1.3" />
    </svg>
  )
}

function DocHeader() {
  return (
    <div className="doc-header">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <span className="doc-logo">GL</span>
        <Butterfly size={26} />
      </div>
      <div className="doc-logo-sub">CIRURGIÃ DENTISTA</div>
    </div>
  )
}

function DocFooter() {
  return (
    <div className="doc-footer">
      <b>Dra. Gabriela Lorenzi</b><br />
      Cirurgiã Dentista · CRO 39889
    </div>
  )
}

/** Uma folha A4 com cabeçalho, marca d'água, título, conteúdo e rodapé. */
export function DocSheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="doc-sheet">
      <div className="doc-watermark">
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: 'italic 700 160px Georgia, serif', color: '#c2478a' }}>GL</div>
          <div style={{ font: "700 22px 'Plus Jakarta Sans'", letterSpacing: '0.3em', color: '#c2478a' }}>CIRURGIÃ DENTISTA</div>
        </div>
      </div>
      <DocHeader />
      <div className="doc-title">{title}</div>
      <div className="doc-body">{children}</div>
      <DocFooter />
    </div>
  )
}

export interface DocCtx {
  patientName?: string
  sex?: string
  birthdate?: string
  cpf?: string
  resp?: string
  respCpf?: string
  anamnese?: Record<string, unknown> | null
  treatments?: { date: string; proc: string; prof?: string; note?: string }[]
  /** Registros da aba Evolução (quando presentes, a Ficha de Evolução usa estes). */
  evolucoes?: { date: string; proc: string; prof?: string; note?: string }[]
  teeth?: { num: number; state: string }[]
}

export interface DocRef {
  key: string
  title: string
  node: (blank: boolean, ctx: DocCtx) => ReactNode
}

/** Overlay em tela cheia com barra (Imprimir / Exportar PDF / Fechar) e uma ou mais folhas. */
export function DocumentViewer({ open, onClose, docs, blank, ctx = {} }: { open: boolean; onClose: () => void; docs: DocRef[]; blank: boolean; ctx?: DocCtx }) {
  if (!open) return null
  const label = docs.length > 1 ? `Pacote — ${docs.length} documentos` : docs[0]?.title
  return (
    <div className="doc-overlay">
      <div className="doc-toolbar">
        <div className="doc-toolbar-title">{label}{blank ? ' · em branco' : ''}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" onClick={() => window.print()}>Exportar PDF</Button>
          <Button icon={<Icon name="print" size={16} />} onClick={() => window.print()}>Imprimir</Button>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </div>
      {docs.map((d) => (
        <DocSheet key={d.key} title={d.title}>{d.node(blank, ctx)}</DocSheet>
      ))}
    </div>
  )
}

/* ---------- Field helpers ---------- */
export function Section({ children }: { children: ReactNode }) {
  return <div className="doc-section-title">{children}</div>
}

export function F({ label, value, blank, grow = true }: { label: string; value?: ReactNode; blank: boolean; grow?: boolean }) {
  return (
    <div className="doc-field" style={grow ? undefined : { display: 'inline-flex', minWidth: 160 }}>
      <span className="doc-field-label">{label}:</span>
      <span className="doc-field-value">{blank ? '' : value ?? ''}</span>
    </div>
  )
}

export function Check({ label, checked, blank }: { label: string; checked?: boolean; blank: boolean }) {
  return (
    <span className="doc-check">
      <span className="doc-box">{!blank && checked ? '✓' : ''}</span>
      {label}
    </span>
  )
}

/** Sim/Não + "qual?" — padrão recorrente nas anamneses. */
export function YesNo({ label, yes, detail, blank }: { label: string; yes?: boolean; detail?: string; blank: boolean }) {
  return (
    <div className="doc-field">
      <span className="doc-field-label">{label}</span>
      <Check label="Não" checked={!blank && yes === false} blank={blank} />
      <Check label="Sim" checked={!blank && yes === true} blank={blank} />
      <span style={{ fontWeight: 700 }}>Qual?</span>
      <span className="doc-field-value">{blank ? '' : detail ?? ''}</span>
    </div>
  )
}

export function Para({ children }: { children: ReactNode }) {
  return <p className="doc-p">{children}</p>
}

export function SignDate({ role, blank }: { role: string; blank: boolean }) {
  return (
    <>
      <div style={{ marginTop: 26, fontSize: 12 }}>
        {CIDADE}, <span className="doc-field-value" style={{ display: 'inline-block', width: 40 }}>{blank ? '' : '17'}</span> de{' '}
        <span className="doc-field-value" style={{ display: 'inline-block', width: 90 }}>{blank ? '' : 'julho'}</span> de{' '}
        <span className="doc-field-value" style={{ display: 'inline-block', width: 60 }}>{blank ? '' : '2026'}</span>.
      </div>
      <div className="doc-sign">
        <div className="doc-sign-line">{role}</div>
      </div>
    </>
  )
}
