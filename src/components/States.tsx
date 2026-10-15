import type { ReactNode } from 'react'
import { Icon, type IconName } from '../icons'
import { Button } from './Button'

export function EmptyState({
  icon = 'box',
  title,
  desc,
  action,
}: {
  icon?: IconName
  title: string
  desc?: string
  action?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 16px' }}>
      <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Icon name={icon} size={26} />
      </div>
      <div style={{ font: "800 15px var(--font)", color: 'var(--ink)' }}>{title}</div>
      {desc && <div style={{ font: "600 12.5px var(--font)", color: 'var(--muted)', margin: '6px 0 14px', maxWidth: 280 }}>{desc}</div>}
      {action}
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 16px' }}>
      <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--red-bg)', color: '#ef6f68', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Icon name="alert" size={26} />
      </div>
      <div style={{ font: "800 15px var(--font)", color: 'var(--ink)' }}>Não foi possível carregar</div>
      <div style={{ font: "600 12.5px var(--font)", color: 'var(--muted)', margin: '6px 0 14px', maxWidth: 280 }}>
        Verifique sua conexão. Seus dados estão salvos e nada foi perdido.
      </div>
      {onRetry && <Button onClick={onRetry}>Tentar novamente</Button>}
    </div>
  )
}

export function SkeletonRows({ rows = 5, cols }: { rows?: number; cols?: number[] }) {
  const widths = cols ?? [48, 200, 120, 90]
  return (
    <div style={{ padding: '4px 20px' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: '1px solid var(--line)' }}>
          <div className="skeleton" style={{ width: 34, height: 34, borderRadius: '50%' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="skeleton" style={{ width: `${widths[1] ?? 200}px`, height: 12 }} />
            <div className="skeleton" style={{ width: `${(widths[2] ?? 120) * 0.7}px`, height: 10 }} />
          </div>
          <div className="skeleton" style={{ width: 70, height: 22, borderRadius: 20 }} />
        </div>
      ))}
    </div>
  )
}
