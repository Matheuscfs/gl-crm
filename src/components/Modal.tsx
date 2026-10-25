import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { pedirConfirmacao } from './confirm'
import { isTopLayer, popLayer, pushLayer } from './layers'

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
  const tryClose = async () => {
    if (dirty && !(await pedirConfirmacao({ title: 'Descartar alterações?', message: 'Você tem dados não salvos — ao fechar eles serão perdidos.', confirmLabel: 'Descartar', cancelLabel: 'Continuar editando', danger: true }))) return
    onClose()
  }
  // a camada entra na pilha só ao abrir; o handler lê sempre o tryClose mais recente
  const tryCloseRef = useRef(tryClose)
  tryCloseRef.current = tryClose

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    const layer = pushLayer()
    const opener = document.activeElement as HTMLElement | null

    // foca o primeiro campo (respeita autoFocus); sem campo, o primeiro botão do corpo/rodapé — nunca o ×
    const t = setTimeout(() => {
      if (dialog && !dialog.contains(document.activeElement)) {
        const first = dialog.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea')
          ?? dialog.querySelector<HTMLElement>('.dialog-body button, .dialog-foot button')
        first?.focus()
      }
    }, 0)

    const onKey = (e: KeyboardEvent) => {
      if (!isTopLayer(layer)) return
      if (e.key === 'Escape') { tryCloseRef.current(); return }
      if (e.key !== 'Tab' || !dialog) return
      const list = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
      if (!list.length) return
      const firstEl = list[0]
      const lastEl = list[list.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      popLayer(layer)
      // devolve o foco a quem abriu o modal (teclado e leitor de tela não se perdem)
      if (opener && opener.isConnected) opener.focus()
    }
  }, [open])

  if (!open) return null

  // portal no <body>: um ancestral com transform/animação (entrada das telas) viraria a
  // referência do position: fixed e a janela abriria no lugar errado
  return createPortal(
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
    </div>,
    document.body,
  )
}
