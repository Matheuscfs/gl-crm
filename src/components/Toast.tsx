import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Icon } from '../icons'

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  kind: ToastKind
  text: string
}

interface ToastApi {
  toast: (text: string, kind?: ToastKind) => void
}

const Ctx = createContext<ToastApi>({ toast: () => {} })

export function useToast() {
  return useContext(Ctx)
}

let seq = 0

let emit: ((text: string, kind?: ToastKind) => void) | null = null
/** Toast de fora de componentes React (ex.: erros de sincronização do store). */
export function toastGlobal(text: string, kind: ToastKind = 'error') {
  emit?.(text, kind)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = ++seq
    setItems((s) => [...s, { id, kind, text }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3200)
  }, [])

  useEffect(() => {
    emit = toast
    return () => { emit = null }
  }, [toast])

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="toast-wrap">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span
              className="toast-icon"
              style={{ color: t.kind === 'error' ? '#dc2626' : t.kind === 'info' ? '#3f6bf5' : '#16a34a' }}
            >
              <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'info' ? 'bell' : 'box'} size={17} />
            </span>
            <span className="toast-text">{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
