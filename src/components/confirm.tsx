import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface Opcoes {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Ação que descarta ou apaga: botão de confirmar em vermelho. */
  danger?: boolean
}
type Pedido = Opcoes & { resolve: (ok: boolean) => void }

let enfileirar: ((p: Pedido) => void) | null = null

/**
 * Confirmação no visual do app, no lugar do `window.confirm` do navegador.
 * Resolve `true` se a pessoa confirmar e `false` se cancelar, apertar Esc ou clicar fora.
 */
export function pedirConfirmacao(opcoes: Opcoes): Promise<boolean> {
  return new Promise((resolve) => {
    // sem o host montado (não deveria acontecer), cai no diálogo do navegador para não perder a pergunta
    if (!enfileirar) { resolve(window.confirm(opcoes.message)); return }
    enfileirar({ ...opcoes, resolve })
  })
}

/** Montado uma vez na raiz do app: mostra os pedidos de confirmação, um de cada vez. */
export function ConfirmHost() {
  const [fila, setFila] = useState<Pedido[]>([])
  useEffect(() => {
    enfileirar = (p) => setFila((f) => [...f, p])
    return () => { enfileirar = null }
  }, [])

  const atual = fila[0]
  const responder = (ok: boolean) => {
    atual?.resolve(ok)
    setFila((f) => f.slice(1))
  }

  return (
    <Modal
      open={!!atual}
      onClose={() => responder(false)}
      title={atual?.title ?? ''}
      width={400}
      footer={
        <>
          <Button variant="outline" onClick={() => responder(false)}>{atual?.cancelLabel ?? 'Cancelar'}</Button>
          <Button variant={atual?.danger ? 'ghost' : 'primary'} className={atual?.danger ? 'btn-danger' : ''} onClick={() => responder(true)}>
            {atual?.confirmLabel ?? 'Confirmar'}
          </Button>
        </>
      }
    >
      <div style={{ font: '400 13.5px/1.6 var(--font)', color: 'var(--slate)' }}>{atual?.message}</div>
    </Modal>
  )
}
