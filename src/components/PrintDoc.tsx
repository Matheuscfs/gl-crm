import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { Icon } from '../icons'
import { DocSheet } from '../pages/documents/DocKit'

/**
 * Overlay de impressão reutilizável (orçamento, recibo, etc.).
 * Renderiza uma folha A4 (DocSheet) com barra Imprimir/Exportar PDF/Fechar.
 * Usa portal em document.body para escapar de ancestrais com `transform`
 * (a animação de rota cria containing-block e prenderia um position:fixed).
 * "Exportar PDF" usa a caixa de impressão do navegador (Salvar como PDF).
 */
export function PrintDoc({ open, title, onClose, children }: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return createPortal(
    <div className="doc-overlay">
      <div className="doc-toolbar">
        <div className="doc-toolbar-title">{title}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" onClick={() => window.print()}>Exportar PDF</Button>
          <Button icon={<Icon name="print" size={16} />} onClick={() => window.print()}>Imprimir</Button>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </div>
      <DocSheet title={title}>{children}</DocSheet>
    </div>,
    document.body,
  )
}
