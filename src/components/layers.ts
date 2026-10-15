import { useEffect, useRef } from 'react'

/**
 * Pilha das camadas abertas (modal, popover, folha "Mais"). Só a de cima responde ao Esc:
 * sem isso, Esc num calendário dentro de um modal fechava os dois — e o que estava
 * digitado no modal se perdia.
 */
const stack: number[] = []
let seq = 0

export function pushLayer(): number {
  const id = ++seq
  stack.push(id)
  return id
}

export function popLayer(id: number) {
  const i = stack.lastIndexOf(id)
  if (i >= 0) stack.splice(i, 1)
}

export const isTopLayer = (id: number) => stack[stack.length - 1] === id

/**
 * Registra uma camada enquanto `active` e chama `onEsc` quando ela é a de cima.
 * A camada entra na pilha só quando abre (não a cada render), então um modal que
 * re-renderiza não passa à frente do calendário aberto dentro dele.
 */
export function useEscLayer(active: boolean, onEsc: () => void) {
  const onEscRef = useRef(onEsc)
  onEscRef.current = onEsc

  useEffect(() => {
    if (!active) return
    const id = pushLayer()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopLayer(id)) onEscRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      popLayer(id)
    }
  }, [active])
}
