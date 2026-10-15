import { Icon } from '../../icons'

export default function Placeholder({ label }: { label: string }) {
  return (
    <div className="tab-body">
      <div className="panel" style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Icon name="box" size={26} />
        </div>
        <h2 className="panel-title" style={{ justifyContent: 'center' }}>{label}</h2>
        <p style={{ font: '400 13px var(--font)', color: 'var(--muted)', margin: '6px 0 0', maxWidth: 320 }}>
          Este módulo faz parte da ficha do paciente e será preenchido com os dados de {label.toLowerCase()}.
        </p>
      </div>
    </div>
  )
}
