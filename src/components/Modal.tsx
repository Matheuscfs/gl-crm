import { useEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 460,
  dirty = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
  /** Com alterações não salvas: fechar por ×, Esc ou clique fora pede confirmação antes de descartar. */
  dirty?: boolean
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const tryClose = () => {
    if (dirty && !window.confirm('Você tem dados não salvos — ao sair eles serão perdidos. Descartar mesmo assim?')) return
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current

    // foca o primeiro campo (respeita autoFocus) ao abrir
    const t = setTimeout(() => {
      if (dialog && !dialog.contains(document.activeElement)) {
        const first = dialog.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea, button')
        first?.focus()
      }
    }, 0)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { tryClose(); return }
      if (e.key !== 'Tab' || !dialog) return
      const list = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
      if (!list.length) return
      const firstEl = list[0]
      const lastEl = list[list.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
    }

    document.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, dirty])

  if (!open) return null

  return (
    <div className="overlay" onMouseDown={tryClose}>
      <div ref={dialogRef} className="dialog" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          <div>
            <div className="dialog-title">{title}</div>
            {subtitle && <div className="dialog-sub">{subtitle}</div>}
          </div>
          <button className="dialog-close" onClick={tryClose} aria-label="Fechar">×</button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  )
}
