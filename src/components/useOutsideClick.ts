import { useEffect, type RefObject } from 'react'
import { useEscLayer } from './layers'

/** Fecha ao clicar fora de todos os `refs` (o gatilho e, se houver, a camada que foi para o <body> por portal). */
export function useOutsideClick(refs: RefObject<HTMLElement> | RefObject<HTMLElement>[], onOutside: () => void, active = true) {
  const lista = Array.isArray(refs) ? refs : [refs]
  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => {
      const alvo = e.target as Node
      if (lista.some((r) => r.current) && !lista.some((r) => r.current?.contains(alvo))) onOutside()
    }
    // captura: o modal para a propagação do mousedown, e sem isso clicar dentro dele não fechava o menu
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...lista, onOutside, active])

  // Esc fecha só este popup, não o modal em volta
  useEscLayer(active, onOutside)
}
