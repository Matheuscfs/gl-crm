import { useRef, useState } from 'react'
import { Icon } from '../icons'
import { useOutsideClick } from './useOutsideClick'

export interface SuggestOption {
  value: string
  sub?: string
}

/**
 * Input com sugestões estilizadas — substitui o <datalist> nativo, que não
 * aceita CSS e renderiza o popup do navegador fora de posição.
 * Digitar filtra a lista; clicar numa opção seleciona (onPick, ou onChange).
 */
export function SuggestInput({ value, options, placeholder, autoFocus, emptyText, onChange, onPick }: {
  value: string
  options: SuggestOption[]
  placeholder?: string
  autoFocus?: boolean
  emptyText?: string
  onChange: (v: string) => void
  onPick?: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)
  const results = value.trim() ? options.filter((o) => o.value.toLowerCase().includes(value.toLowerCase())) : options
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className="field-input"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onClick={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
      />
      <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%) rotate(-90deg)', pointerEvents: 'none', color: 'var(--muted)' }}>
        <Icon name="chevron" size={16} />
      </span>
      {open && (
        <div className="menu-pop" style={{ left: 0, right: 0, width: 'auto', maxHeight: 240, overflow: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '9px 11px', font: "600 12px var(--font)", color: 'var(--muted)' }}>{emptyText ?? 'Sem correspondência.'}</div>
          ) : results.map((o) => (
            <button key={o.value} className="menu-item" onClick={() => { (onPick ?? onChange)(o.value); setOpen(false) }}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ font: "700 12.5px var(--font)", color: 'var(--ink)' }}>{o.value}</span>
                {o.sub && <span style={{ font: "600 11px var(--font)", color: 'var(--muted)' }}>{o.sub}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
