import { useRef, useState, type ReactNode } from 'react'
import { useOutsideClick } from './useOutsideClick'
import { Popover } from './Popover'
import { Icon } from '../icons'

export interface MenuItem {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

/** A "⋮" (or custom trigger) button that opens an anchored, animated menu. */
export function Menu({
  items,
  trigger,
  align = 'right',
  width = 190,
}: {
  items: MenuItem[]
  trigger?: ReactNode
  align?: 'left' | 'right'
  width?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  useOutsideClick([ref, popRef], () => setOpen(false), open)

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        className="icon-btn"
        style={{ border: 'none', background: 'transparent', color: 'var(--muted)', width: 30, height: 30 }}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-label="Abrir menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger ?? <Icon name="dots" size={18} />}
      </button>
      <Popover anchor={ref} popRef={popRef} open={open} align={align} width={width} role="menu" onClick={(e) => e.stopPropagation()}>
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              className={`menu-item${it.danger ? ' danger' : ''}`}
              disabled={it.disabled}
              onClick={() => {
                setOpen(false)
                it.onClick()
              }}
            >
              {it.label}
            </button>
          ))}
      </Popover>
    </div>
  )
}

/** A labelled filter dropdown (chip trigger + option list). */
export function Dropdown({
  label,
  value,
  options,
  onChange,
  active,
}: {
  label: string
  value?: string
  options: string[]
  onChange: (v: string) => void
  active?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  useOutsideClick([ref, popRef], () => setOpen(false), open)
  const on = active ?? (!!value && value !== options[0])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="chip"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 34,
          padding: '0 13px',
          borderRadius: 9,
          font: "700 12.5px var(--font)",
          ...(on
            ? { border: '1px solid var(--primary-border)', background: 'var(--primary-bg)', color: 'var(--primary-dark)' }
            : { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--slate)' }),
        }}
      >
        {value && value !== options[0] ? value : label} ▾
      </button>
      <Popover anchor={ref} popRef={popRef} open={open} width={210} onClick={(e) => e.stopPropagation()}>
          {options.map((o) => (
            <button
              key={o}
              className={`menu-item${o === value ? ' selected' : ''}`}
              onClick={() => {
                setOpen(false)
                onChange(o)
              }}
            >
              {o}
            </button>
          ))}
      </Popover>
    </div>
  )
}
