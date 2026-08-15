import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/Button'

const MAX_W = 560
type Tool = 'suavizar' | 'clarear' | 'volume' | 'empurrar'

/* ---------- operações de pixel ---------- */
// box blur separável de uma região (RGBA)
function boxBlur(src: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  const tmp = new Uint8ClampedArray(src.length)
  const out = new Uint8ClampedArray(src.length)
  const r = Math.max(1, Math.round(radius))
  // horizontal
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0, count = 0
      for (let x = -r; x <= r; x++) { const xx = Math.min(w - 1, Math.max(0, x)); sum += src[(y * w + xx) * 4 + c]; count++ }
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 4 + c] = sum / count
        const add = Math.min(w - 1, x + r + 1), sub = Math.max(0, x - r)
        sum += src[(y * w + add) * 4 + c] - src[(y * w + sub) * 4 + c]
      }
    }
    for (let x = 0; x < w; x++) tmp[(y * w + x) * 4 + 3] = 255
  }
  // vertical
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0, count = 0
      for (let y = -r; y <= r; y++) { const yy = Math.min(h - 1, Math.max(0, y)); sum += tmp[(yy * w + x) * 4 + c]; count++ }
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + c] = sum / count
        const add = Math.min(h - 1, y + r + 1), sub = Math.max(0, y - r)
        sum += tmp[(add * w + x) * 4 + c] - tmp[(sub * w + x) * 4 + c]
      }
    }
    for (let y = 0; y < h; y++) out[(y * w + x) * 4 + 3] = 255
  }
  return out
}

function sampleBilinear(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, out: number[]) {
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(x)))
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(y)))
  const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1)
  const fx = x - x0, fy = y - y0
  for (let c = 0; c < 4; c++) {
    const a = data[(y0 * w + x0) * 4 + c], b = data[(y0 * w + x1) * 4 + c]
    const cc = data[(y1 * w + x0) * 4 + c], d = data[(y1 * w + x1) * 4 + c]
    out[c] = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + cc * (1 - fx) * fy + d * fx * fy
  }
}

export function SimulationEditor({ src, onClose, onSave }: { src: string; onClose: () => void; onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('suavizar')
  const [size, setSize] = useState(45)
  const [intensity, setIntensity] = useState(55)
  const [ready, setReady] = useState(false)
  const drawing = useRef(false)
  const history = useRef<ImageData[]>([])
  const original = useRef<ImageData | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const scale = Math.min(1, MAX_W / img.width)
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      original.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
      history.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)]
      setReady(true)
    }
    img.onerror = () => setReady(false)
    img.src = src
  }, [src])

  const toCanvasCoords = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height }
  }

  const brushRadius = () => Math.round((size / 100) * 70) + 8
  // falloff suave (smoothstep) do centro à borda — padrão das ferramentas de mercado
  const falloff = (d: number, r: number) => { const t = Math.max(0, 1 - d / r); return t * t * (3 - 2 * t) }

  const applyBrush = (cx: number, cy: number, dx = 0, dy = 0) => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const r = brushRadius()
    const strength = intensity / 100
    // margem extra para o warp puxar pixels de fora da região
    const pad = tool === 'empurrar' ? Math.ceil(Math.hypot(dx, dy)) + 2 : 2
    const x0 = Math.max(0, Math.floor(cx - r - pad)), y0 = Math.max(0, Math.floor(cy - r - pad))
    const w = Math.min(canvas.width, Math.ceil(cx + r + pad)) - x0
    const h = Math.min(canvas.height, Math.ceil(cy + r + pad)) - y0
    if (w <= 0 || h <= 0) return
    const region = ctx.getImageData(x0, y0, w, h)
    const src0 = new Uint8ClampedArray(region.data) // snapshot p/ amostragem
    const dst = region.data
    const lcx = cx - x0, lcy = cy - y0
    const out: number[] = [0, 0, 0, 0]

    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ddx = x - lcx, ddy = y - lcy
      const dist = Math.hypot(ddx, ddy)
      if (dist > r) continue
      const f = falloff(dist, r) * strength
      if (f <= 0) continue
      const i = (y * w + x) * 4
      if (tool === 'clarear') {
        for (let c = 0; c < 3; c++) dst[i + c] = src0[i + c] + (255 - src0[i + c]) * f * 0.6
      } else if (tool === 'volume') {
        // bloat: amostra mais perto do centro → expande (efeito de volume)
        const factor = 1 - f * 0.5
        sampleBilinear(src0, w, h, lcx + ddx * factor, lcy + ddy * factor, out)
        for (let c = 0; c < 3; c++) dst[i + c] = out[c]
      } else if (tool === 'empurrar') {
        // forward warp: empurra os pixels na direção do arraste
        sampleBilinear(src0, w, h, x - dx * f, y - dy * f, out)
        for (let c = 0; c < 3; c++) dst[i + c] = out[c]
      }
    }

    if (tool === 'suavizar') {
      const blurred = boxBlur(src0, w, h, 2 + Math.round(strength * 3))
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dist = Math.hypot(x - lcx, y - lcy)
        if (dist > r) continue
        const t = Math.min(0.85, falloff(dist, r) * strength)
        const i = (y * w + x) * 4
        for (let c = 0; c < 3; c++) dst[i + c] = src0[i + c] * (1 - t) + blurred[i + c] * t
      }
    }
    ctx.putImageData(region, x0, y0)
  }

  const lastPt = useRef<{ x: number; y: number } | null>(null)
  const onDown = (e: React.PointerEvent) => {
    if (!ready) return
    drawing.current = true
    const p = toCanvasCoords(e)
    lastPt.current = p
    applyBrush(p.x, p.y)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !lastPt.current) return
    const cur = toCanvasCoords(e)
    const last = lastPt.current
    const dist = Math.hypot(cur.x - last.x, cur.y - last.y)
    // strokes contínuos: aplica em passos ao longo do trajeto (evita "buracos")
    const spacing = Math.max(1, brushRadius() * 0.2)
    const steps = Math.max(1, Math.floor(dist / spacing))
    const sdx = (cur.x - last.x) / steps
    const sdy = (cur.y - last.y) / steps
    for (let s = 1; s <= steps; s++) applyBrush(last.x + sdx * s, last.y + sdy * s, sdx, sdy)
    lastPt.current = cur
  }
  const onUp = () => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    history.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (history.current.length > 20) history.current.shift()
  }

  const restore = (img: ImageData) => { const c = canvasRef.current!; c.getContext('2d')!.putImageData(img, 0, 0) }
  const undo = () => { if (history.current.length > 1) { history.current.pop(); restore(history.current[history.current.length - 1]) } }
  const reset = () => { if (original.current) { restore(original.current); history.current = [original.current] } }
  const compareDown = () => { if (original.current) restore(original.current) }
  const compareUp = () => { const h = history.current[history.current.length - 1]; if (h) restore(h) }
  const salvar = () => {
    try {
      const url = canvasRef.current!.toDataURL('image/jpeg', 0.9)
      onSave(url)
    } catch {
      alert('Não foi possível exportar a imagem (restrição de origem da foto). Envie a foto pelo botão "Enviar antes" novamente.')
    }
  }

  const TOOLS: { key: Tool; label: string }[] = [{ key: 'empurrar', label: 'Empurrar' }, { key: 'suavizar', label: 'Suavizar' }, { key: 'clarear', label: 'Clarear' }, { key: 'volume', label: 'Volume' }]

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(24,28,44,0.55)', display: 'flex', flexDirection: 'column', animation: 'overlay-in 0.2s ease both' }}>
      <div className="doc-toolbar" style={{ padding: '8px 16px' }}>
        <div className="doc-toolbar-title">Editor de projeção</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" size="sm" onMouseDown={compareDown} onMouseUp={compareUp} onMouseLeave={compareUp}>Comparar</Button>
          <Button variant="outline" size="sm" onClick={undo}>Desfazer</Button>
          <Button variant="outline" size="sm" onClick={reset}>Restaurar</Button>
          <Button size="sm" onClick={salvar}>Salvar projeção</Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 14, padding: 14, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: 8, boxShadow: '0 20px 60px -24px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '100%' }}>
          <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
            style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 130px)', width: 'auto', height: 'auto', borderRadius: 8, cursor: 'crosshair', touchAction: 'none', display: 'block' }} />
          <div style={{ font: "700 10px 'Plus Jakarta Sans'", color: '#c2478a', textAlign: 'center', marginTop: 6 }}>Simulação — não constitui garantia de resultado</div>
        </div>

        <div style={{ width: 230, background: '#fff', borderRadius: 14, padding: '14px 16px', flex: 'none', boxShadow: '0 20px 60px -24px rgba(0,0,0,.4)', maxHeight: '100%', overflow: 'auto' }}>
          <div style={{ font: "800 13px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 10 }}>Ferramenta</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {TOOLS.map((t) => (
              <button key={t.key} onClick={() => setTool(t.key)} className="chip" style={{ flex: '1 1 46%', padding: '8px 0', borderRadius: 9, font: "700 11.5px 'Plus Jakarta Sans'", border: `1px solid ${tool === t.key ? '#cdd8ff' : '#e5e9f2'}`, background: tool === t.key ? '#e9eeff' : '#fff', color: tool === t.key ? '#2f52e0' : '#5b647a' }}>{t.label}</button>
            ))}
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: "700 11px 'Plus Jakarta Sans'", color: '#5b647a', marginBottom: 3 }}><span>Tamanho do pincel</span><span>{size}%</span></div>
            <input type="range" min={5} max={100} value={size} onChange={(e) => setSize(Number(e.target.value))} style={{ width: '100%', accentColor: '#3f6bf5' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: "700 11px 'Plus Jakarta Sans'", color: '#5b647a', marginBottom: 3 }}><span>Intensidade</span><span>{intensity}%</span></div>
            <input type="range" min={5} max={100} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} style={{ width: '100%', accentColor: '#c2478a' }} />
          </div>
          <div style={{ font: "600 11px/1.5 'Plus Jakarta Sans'", color: '#8b93a7', marginTop: 6 }}>
            <b>Empurrar</b> arrasta os pixels na direção do movimento (remodela contorno, lábios, mandíbula). <b>Suavizar</b> reduz rugas, <b>Clarear</b> ilumina, <b>Volume</b> projeta preenchimento. Segure <b>Comparar</b> para ver o original.
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
