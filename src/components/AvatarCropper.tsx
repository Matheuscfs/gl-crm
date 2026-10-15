import { useEffect, useRef, useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

const BOX = 280 // área de edição (px)
const OUT = 512 // resolução do corte exportado

/**
 * Editor de foto de perfil: arraste para posicionar, use o controle para dar
 * zoom e salve — o corte circular é exportado em 512×512 (JPEG).
 */
export function AvatarCropper({ file, onCancel, onSave }: {
  file: File | null
  onCancel: () => void
  onSave: (cropped: File) => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!file) { setSrc(null); return }
    const url = URL.createObjectURL(file)
    setSrc(url)
    setZoom(1)
    setOff({ x: 0, y: 0 })
    setReady(false)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const scaleFor = (img: HTMLImageElement) => Math.max(BOX / img.naturalWidth, BOX / img.naturalHeight) * zoom

  const clampOff = (x: number, y: number, img: HTMLImageElement, z = zoom) => {
    const s = Math.max(BOX / img.naturalWidth, BOX / img.naturalHeight) * z
    const maxX = Math.max(0, (img.naturalWidth * s - BOX) / 2)
    const maxY = Math.max(0, (img.naturalHeight * s - BOX) / 2)
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) }
  }

  const startDrag = (down: React.PointerEvent) => {
    const img = imgRef.current
    if (!img) return
    down.preventDefault()
    const ox = off.x, oy = off.y, x0 = down.clientX, y0 = down.clientY
    const move = (m: PointerEvent) => setOff(clampOff(ox + (m.clientX - x0), oy + (m.clientY - y0), img))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const setZoomClamped = (z: number) => {
    setZoom(z)
    const img = imgRef.current
    if (img) setOff((o) => clampOff(o.x, o.y, img, z))
  }

  const exportar = () => {
    const img = imgRef.current
    if (!img) return
    setSaving(true)
    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    const c = canvas.getContext('2d')!
    const s = scaleFor(img)
    const f = OUT / BOX
    c.fillStyle = '#fff'
    c.fillRect(0, 0, OUT, OUT)
    c.drawImage(
      img,
      (BOX / 2 + off.x - (img.naturalWidth * s) / 2) * f,
      (BOX / 2 + off.y - (img.naturalHeight * s) / 2) * f,
      img.naturalWidth * s * f,
      img.naturalHeight * s * f,
    )
    canvas.toBlob((blob) => {
      setSaving(false)
      if (!blob) return
      onSave(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.9)
  }

  return (
    <Modal open={!!file} onClose={onCancel} title="Ajustar foto" subtitle="Arraste para posicionar · use o controle para dar zoom" width={360}
      footer={<><Button variant="outline" onClick={onCancel}>Cancelar</Button><Button loading={saving} onClick={exportar} disabled={!ready}>Salvar foto</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div
          onPointerDown={startDrag}
          style={{ position: 'relative', width: BOX, height: BOX, borderRadius: 14, overflow: 'hidden', background: '#eef1f6', cursor: 'grab', touchAction: 'none' }}
        >
          {src && (
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={() => setReady(true)}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px)) scale(1)`,
                width: imgRef.current ? imgRef.current.naturalWidth * scaleFor(imgRef.current) : undefined,
                height: imgRef.current ? imgRef.current.naturalHeight * scaleFor(imgRef.current) : undefined,
                maxWidth: 'none',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          )}
          {/* máscara circular de pré-visualização */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at center, transparent 0 39%, rgba(20,28,40,.45) 40%)' }} />
          <div style={{ position: 'absolute', inset: '11%', borderRadius: '50%', border: '2px solid rgba(255,255,255,.9)', pointerEvents: 'none' }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', font: "700 11.5px var(--font)", color: 'var(--slate)' }}>
          Zoom
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoomClamped(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--primary)' }} />
        </label>
      </div>
    </Modal>
  )
}
