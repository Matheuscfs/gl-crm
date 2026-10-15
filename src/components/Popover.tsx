import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/**
 * Camada flutuante presa a um elemento (menu "⋮", filtro, calendário, sugestões).
 * Vai para o <body> por portal: dentro de modal ou de cartão com rolagem ela não é mais
 * cortada. Abre para baixo e, sem espaço, para cima; fica dentro da tela e acompanha
 * rolagem, redimensionamento e mudança de altura (ex.: calendário trocando de mês para ano).
 *
 * Como o portal sai da árvore do DOM, quem fecha ao clicar fora precisa olhar também
 * o `popRef` (veja `useOutsideClick` com lista de refs).
 */
export function Popover({
  anchor,
  popRef,
  open,
  align = 'left',
  width,
  matchWidth = false,
  className = 'menu-pop',
  style,
  role,
  onClick,
  children,
}: {
  anchor: RefObject<HTMLElement>
  popRef: RefObject<HTMLDivElement>
  open: boolean
  /** Borda do elemento com que a camada se alinha. */
  align?: 'left' | 'right'
  width?: number
  /** Mesma largura do elemento (lista de sugestões de um campo). */
  matchWidth?: boolean
  className?: string
  style?: CSSProperties
  role?: string
  onClick?: (e: React.MouseEvent) => void
  children: ReactNode
}) {
  const [pos, setPos] = useState<{ top: number; left: number; w?: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const calc = () => {
      const a = anchor.current
      const p = popRef.current
      if (!a) return
      const r = a.getBoundingClientRect()
      const w = matchWidth ? r.width : width ?? p?.offsetWidth ?? 0
      const h = p?.offsetHeight ?? 0
      const gap = 6
      const abaixo = window.innerHeight - r.bottom
      const paraCima = abaixo < h + gap + 8 && r.top > abaixo
      const left = Math.max(8, Math.min(align === 'right' ? r.right - w : r.left, window.innerWidth - w - 8))
      const top = paraCima ? Math.max(8, r.top - h - gap) : r.bottom + gap
      setPos((prev) => (prev && prev.top === top && prev.left === left && prev.w === w ? prev : { top, left, w: matchWidth ? w : undefined }))
    }
    calc()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(calc) : null
    if (ro && popRef.current) ro.observe(popRef.current)
    window.addEventListener('resize', calc)
    window.addEventListener('scroll', calc, true)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', calc)
      window.removeEventListener('scroll', calc, true)
    }
  }, [open, anchor, popRef, align, width, matchWidth])

  if (!open) return null
  return createPortal(
    <div
      ref={popRef}
      className={`${className} pop-portal`}
      role={role}
      onClick={onClick}
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: pos?.w ?? width,
        // primeira pintura fora de vista, só para medir a altura
        visibility: pos ? undefined : 'hidden',
        ...style,
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
