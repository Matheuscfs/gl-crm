import { Icon } from '../../icons'

export default function Placeholder({ label }: { label: string }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px' }}>
      <div
        className="card"
        style={{
          padding: '48px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ width: 64, height: 64, borderRadius: 20, background: '#e9eeff', color: '#3f6bf5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Icon name="box" size={26} />
        </div>
        <div style={{ font: "800 15px 'Plus Jakarta Sans'", color: '#1a2426' }}>{label}</div>
        <div style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#8a9699', margin: '6px 0 0', maxWidth: 320 }}>
          Este módulo faz parte da ficha do paciente e será preenchido com os dados de {label.toLowerCase()}.
        </div>
      </div>
    </div>
  )
}
