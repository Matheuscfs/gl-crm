import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/Button'
import { useEscLayer } from '../../components/layers'
import { Icon } from '../../icons'
import { useClinic, cidadeUf } from '../../lib/clinic'
import { BRAND } from '../../brand'
import { parseISO, todayISO } from '../../lib/dates'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

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

/** Rodapé com os dados de Configurações → Perfil da clínica (nada fixo no código). */
function DocFooter() {
  const clinic = useClinic()
  const local = cidadeUf(clinic)
  // endereço antigo podia guardar só a cidade: não repete
  const contato = [clinic.address !== local ? clinic.address : '', local, clinic.phone].filter(Boolean).join(' · ')
  return (
    <div className="doc-footer">
      <b>{clinic.profissional}</b><br />
      {clinic.especialidade} · {clinic.cro}
      {contato && <><br /><span style={{ fontSize: 10 }}>{contato}</span></>}
    </div>
  )
}

/** Uma folha A4 com cabeçalho, marca d'água, título, conteúdo e rodapé. */
export function DocSheet({ title, children, rodape = true }: { title: string; children: ReactNode; rodape?: boolean }) {
  return (
    <div className="doc-sheet">
      <div className="doc-watermark">
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: 'italic 700 160px Georgia, serif', color: '#c2478a' }}>GL</div>
          <div style={{ font: "700 22px var(--font)", letterSpacing: '0.3em', color: '#c2478a' }}>CIRURGIÃ DENTISTA</div>
        </div>
      </div>
      <DocHeader />
      <div className="doc-title">{title}</div>
      <div className="doc-body">{children}</div>
      {rodape && <DocFooter />}
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
  teeth?: { num: number; state: string; faces?: string }[]
  /** Layout da dentição que está na tela (impressão a partir do Odontograma). */
  dentLayout?: { titulo: string; sup: string[]; inf: string[] }
  /** Paciente de demonstração: só aí os campos vazios recebem respostas de exemplo. */
  demo?: boolean
  /** Conteúdo de documento emitido (receita, atestado, declaração). */
  emissao?: Emissao
}

export interface ItemReceita { med: string; qtd: string; posologia: string }
export interface Emissao {
  /** Data do documento (ISO). Padrão: hoje. */
  data?: string
  receita?: { uso: string; itens: ItemReceita[]; controleEspecial?: boolean }
  atestado?: { inicio: string; fim: string; dias: number; cid?: string; cidAutorizado?: boolean; finalidade?: string }
  declaracao?: { inicio: string; fim: string; para: 'paciente' | 'acompanhante'; acompanhante?: string }
}

export interface DocRef {
  key: string
  title: string
  node: (blank: boolean, ctx: DocCtx) => ReactNode
}

/**
 * Tela cheia de documento: barra (Exportar PDF / Imprimir / Fechar) e as folhas A4.
 * Vai para o <body> por portal — a animação de rota cria containing block e prenderia o
 * position:fixed, e na impressão o resto do app sai do fluxo (cada folha vira uma página).
 * Esc fecha. Base do `PrintDoc` (uma folha) e do `DocumentViewer` (pacote de documentos).
 */
export function DocOverlay({ open, titulo, onClose, children }: { open: boolean; titulo: string; onClose: () => void; children: ReactNode }) {
  useEscLayer(open, onClose)
  if (!open) return null
  const imprimir = () => {
    // o "Salvar como PDF" usa o título da página como nome do arquivo
    const antes = document.title
    document.title = titulo
    window.addEventListener('afterprint', () => { document.title = antes }, { once: true })
    window.print()
  }
  return createPortal(
    <div className="doc-overlay" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="doc-toolbar">
        <div className="doc-toolbar-title">{titulo}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" onClick={imprimir}>Exportar PDF</Button>
          <Button icon={<Icon name="print" size={16} />} onClick={imprimir}>Imprimir</Button>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </div>
      {children}
    </div>,
    document.body,
  )
}

/** Um ou mais documentos do catálogo (pacote) no `DocOverlay`. */
export function DocumentViewer({ open, onClose, docs, blank, ctx = {} }: { open: boolean; onClose: () => void; docs: DocRef[]; blank: boolean; ctx?: DocCtx }) {
  const label = (docs.length > 1 ? `Pacote — ${docs.length} documentos` : docs[0]?.title ?? 'Documento') + (blank ? ' · em branco' : '')
  return (
    <DocOverlay open={open} titulo={label} onClose={onClose}>
      {docs.map((d) => (
        <DocSheet key={d.key} title={d.title}>{d.node(blank, ctx)}</DocSheet>
      ))}
    </DocOverlay>
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

/** Local e data (de hoje, ou a do documento) + linha de assinatura. */
export function SignDate({ role, blank, date }: { role: string; blank: boolean; date?: string }) {
  const clinic = useClinic()
  const d = parseISO(date || todayISO())
  return (
    <>
      <div style={{ marginTop: 26, fontSize: 12 }}>
        {cidadeUf(clinic) || BRAND.city}, <span className="doc-field-value" style={{ display: 'inline-block', width: 40 }}>{blank ? '' : d.getDate()}</span> de{' '}
        <span className="doc-field-value" style={{ display: 'inline-block', width: 90 }}>{blank ? '' : MESES[d.getMonth()]}</span> de{' '}
        <span className="doc-field-value" style={{ display: 'inline-block', width: 60 }}>{blank ? '' : d.getFullYear()}</span>.
      </div>
      <div className="doc-sign">
        <div className="doc-sign-line">{role}</div>
      </div>
    </>
  )
}
