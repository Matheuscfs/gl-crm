import type { ReactNode } from 'react'
import { DocOverlay, DocSheet } from '../pages/documents/DocKit'

/**
 * Uma folha A4 avulsa (orçamento, recibo, ficha de evolução) no mesmo `DocOverlay` do
 * catálogo de documentos: portal, barra Imprimir/Exportar PDF/Fechar e Esc para fechar.
 */
export function PrintDoc({ open, title, onClose, children, rodape = true }: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  /** Sem o rodapé padrão (quando o conteúdo já tem a própria assinatura, como o recibo). */
  rodape?: boolean
}) {
  return (
    <DocOverlay open={open} titulo={title} onClose={onClose}>
      <DocSheet title={title} rodape={rodape}>{children}</DocSheet>
    </DocOverlay>
  )
}
