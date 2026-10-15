import { Modal } from './Modal'
import { Button } from './Button'

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Excluir',
  danger = true,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={400}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant={danger ? 'ghost' : 'primary'} className={danger ? 'btn-danger' : ''} onClick={() => { onClose(); onConfirm() }}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ font: "500 13px/1.6 var(--font)", color: 'var(--slate)' }}>{message}</div>
    </Modal>
  )
}
