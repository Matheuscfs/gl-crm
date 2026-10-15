import { useEffect, type RefObject } from 'react'
import { useEscLayer } from './layers'

export function useOutsideClick(ref: RefObject<HTMLElement>, onOutside: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onOutside, active])

  // Esc fecha só este popup, não o modal em volta
  useEscLayer(active, onOutside)
}
