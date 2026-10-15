import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { usePatientId } from '../../lib/useCollection'
import { useParams } from 'react-router-dom'
import { DEMO_DATA } from '../../lib/demo'
import { isSeedPatient } from '../../data'

/** Zona de aplicação no desenho (viewBox 300×380, rosto de frente). `par`: a zona existe dos dois lados. */
interface Zone { id: string; label: string; cx: number; cy: number; rx: number; ry: number; color: string; par?: boolean }

// D/E são do paciente: o lado direito dele aparece à esquerda de quem olha
const ZONES: Zone[] = [
  { id: 'testa', label: 'Testa (frontal)', cx: 150, cy: 98, rx: 46, ry: 17, color: '#7c3aed' },
  { id: 'glabela', label: 'Glabela', cx: 150, cy: 131, rx: 11, ry: 10, color: '#c2478a' },
  { id: 'pgd', label: 'Pés de galinha D', cx: 91, cy: 152, rx: 10, ry: 14, color: '#d97706' },
  { id: 'pge', label: 'Pés de galinha E', cx: 209, cy: 152, rx: 10, ry: 14, color: '#d97706' },
  { id: 'naso', label: 'Sulco nasolabial', cx: 127, cy: 216, rx: 8, ry: 15, color: '#16a34a', par: true },
  { id: 'mento', label: 'Mento', cx: 150, cy: 276, rx: 18, ry: 11, color: '#4f46e5' },
  { id: 'massd', label: 'Masseter D', cx: 100, cy: 232, rx: 11, ry: 18, color: '#0891b2' },
  { id: 'masse', label: 'Masseter E', cx: 200, cy: 232, rx: 11, ry: 18, color: '#0891b2' },
]

// unidades de exemplo só nos pacientes de demonstração; cadastro real começa zerado
const DEMO_UNITS: Record<string, number> = { testa: 10, glabela: 8, pgd: 6, pge: 6, naso: 0, mento: 0, massd: 0, masse: 0 }
const ZERO_UNITS: Record<string, number> = Object.fromEntries(ZONES.map((z) => [z.id, 0]))

/** Pontos de aplicação: ~1 a cada 2U, espalhados em girassol dentro da elipse da zona. */
function pontos(z: Zone, u: number, cx: number): [number, number][] {
  const lados = z.par ? 2 : 1
  const n = u > 0 ? Math.min(14, Math.max(1, Math.round(u / 2 / lados))) : 0
  return Array.from({ length: n }, (_, k) => {
    const ang = k * 2.39996
    const r = 0.7 * Math.sqrt((k + 0.5) / n)
    return [cx + Math.cos(ang) * r * z.rx, z.cy + Math.sin(ang) * r * z.ry]
  })
}

/**
 * Rosto de frente ilustrado: pele com degradê, sombreamento suave das maçãs e da mandíbula,
 * olhos com íris e brilho, sobrancelhas, lábios com cor, cabelo preso com risca no meio,
 * pescoço, clavículas e ombros. Metade esquerda desenhada uma vez e espelhada (simetria perfeita).
 * As zonas de aplicação ficam em coordenadas fixas por cima (viewBox 300×380).
 */
function Rosto() {
  return (
    <g aria-hidden="true">
      <defs>
        <radialGradient id="mf-pele" cx="50%" cy="38%" r="70%">
          <stop offset="0" stopColor="#fdeee7" />
          <stop offset="0.65" stopColor="#f6dccf" />
          <stop offset="1" stopColor="#eac4b4" />
        </radialGradient>
        <linearGradient id="mf-pescoco" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6bfae" />
          <stop offset="0.35" stopColor="#f3d6c8" />
          <stop offset="1" stopColor="#f6dccf" />
        </linearGradient>
        <linearGradient id="mf-cabelo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b4636" />
          <stop offset="1" stopColor="#3f281f" />
        </linearGradient>
        <radialGradient id="mf-blush" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#f19bb0" stopOpacity="0.42" />
          <stop offset="1" stopColor="#f19bb0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mf-brilho" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mf-iris" cx="45%" cy="40%" r="60%">
          <stop offset="0" stopColor="#a87b52" />
          <stop offset="0.6" stopColor="#6e4628" />
          <stop offset="1" stopColor="#3b2416" />
        </radialGradient>
        <linearGradient id="mf-labios" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9707f" />
          <stop offset="1" stopColor="#c45a6b" />
        </linearGradient>
        <filter id="mf-sombra" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" /></filter>
        <filter id="mf-suave" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.4" /></filter>
        <clipPath id="mf-rosto-clip">
          <path d="M150 44C100 44 74 84 74 140c0 36 6 66 20 94 14 28 34 52 56 62 22-10 42-34 56-62 14-28 20-58 20-94 0-56-26-96-76-96z" />
        </clipPath>
        {/* metade esquerda (de quem olha): espelhada para a direita */}
        <g id="mf-meia">
          {/* orelha */}
          <path d="M77 142c-12-7-18 4-16 20 2 15 8 24 17 23" fill="url(#mf-pele)" stroke="#d9ac9b" strokeWidth="1.2" />
          <path d="M72 152c-3 6-2 14 3 20" fill="none" stroke="#d9ac9b" strokeWidth="1" />
          {/* sobrancelha */}
          <path d="M99 131c6-9 20-15 42-9-14-1-27 3-38 11z" fill="#6b4a3a" />
          {/* olho: branco, íris, pálpebra, vinco e cílios */}
          <path d="M102 151c9-10 30-12 40-2-8 8-30 9-40 2z" fill="#fff" />
          <circle cx="122.5" cy="150" r="6.4" fill="url(#mf-iris)" />
          <circle cx="122.5" cy="150" r="2.7" fill="#1e130e" />
          <circle cx="124.6" cy="147.9" r="1.6" fill="#fff" />
          <path d="M102 151c9-10 30-12 40-2" fill="none" stroke="#3e2a22" strokeWidth="2.1" strokeLinecap="round" />
          <path d="M102 151c9 7 30 8 40-2" fill="none" stroke="#c49a8b" strokeWidth="0.9" />
          <path d="M106 143c8-8 26-9 35-2" fill="none" stroke="#d1a596" strokeWidth="1" />
          <path d="M140 147.5l5-3.2M137.6 145.6l3.6-4.1M134.4 144.3l2.2-4.6" stroke="#3e2a22" strokeWidth="1.1" strokeLinecap="round" />
          {/* asa do nariz */}
          <path d="M138 189c-7 3-7 11-1 13" fill="none" stroke="#c48d7e" strokeWidth="1.3" strokeLinecap="round" />
          <ellipse cx="143" cy="200.5" rx="3.3" ry="1.6" transform="rotate(-18 143 200.5)" fill="#9e6a5c" opacity="0.75" />
          {/* blush da maçã do rosto */}
          <ellipse cx="106" cy="194" rx="24" ry="17" fill="url(#mf-blush)" />
          {/* clavícula */}
          <path d="M100 352c16 4 32 4 46-2" fill="none" stroke="#d7ab9a" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      </defs>

      {/* cabelo de trás (preso), pescoço e ombros */}
      <path d="M68 150C58 74 100 24 150 24s92 50 82 126c-2 40-12 74-30 102H98C80 224 70 190 68 150z" fill="url(#mf-cabelo)" />
      <path d="M121 276c2 26 0 48-6 64-26 7-56 16-79 40h228c-23-24-53-33-79-40-6-16-8-38-6-64z" fill="url(#mf-pescoco)" />
      <ellipse cx="150" cy="300" rx="34" ry="12" fill="#c98f7c" opacity="0.35" filter="url(#mf-sombra)" />

      {/* rosto */}
      <path d="M150 44C100 44 74 84 74 140c0 36 6 66 20 94 14 28 34 52 56 62 22-10 42-34 56-62 14-28 20-58 20-94 0-56-26-96-76-96z" fill="url(#mf-pele)" stroke="#dcb1a1" strokeWidth="1.2" />
      <g clipPath="url(#mf-rosto-clip)">
        {/* sombreamento: abaixo das maçãs, mandíbula, laterais do nariz */}
        <path d="M80 186c8 40 30 78 70 100 40-22 62-60 70-100" fill="none" stroke="#d29b88" strokeWidth="14" opacity="0.32" filter="url(#mf-sombra)" />
        <path d="M100 214c10 6 18 6 26 2M200 214c-10 6-18 6-26 2" fill="none" stroke="#d29b88" strokeWidth="6" opacity="0.3" filter="url(#mf-sombra)" />
        <path d="M143 140c-2 18-4 34-8 48M157 140c2 18 4 34 8 48" fill="none" stroke="#d6a493" strokeWidth="3.5" opacity="0.45" filter="url(#mf-suave)" />
        {/* brilho na testa, no dorso do nariz e no queixo */}
        <ellipse cx="150" cy="104" rx="40" ry="20" fill="url(#mf-brilho)" />
        <ellipse cx="150" cy="176" rx="5" ry="16" fill="url(#mf-brilho)" />
        <ellipse cx="150" cy="268" rx="14" ry="8" fill="url(#mf-brilho)" />
      </g>

      {/* traços espelhados (orelhas, sobrancelhas, olhos, nariz, blush, clavículas) */}
      <use href="#mf-meia" />
      <use href="#mf-meia" transform="translate(300 0) scale(-1 1)" />

      {/* ponta do nariz */}
      <path d="M135 196c5 7 12 9 15 7 3 2 10 0 15-7" fill="none" stroke="#c48d7e" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="150" cy="193" rx="6" ry="3.5" fill="#fff" opacity="0.35" />
      {/* boca */}
      <path d="M126 230c8-6 17-8 24-4 7-4 16-2 24 4-10 4-38 4-48 0z" fill="url(#mf-labios)" />
      <path d="M126 230c9 15 39 15 48 0-10 4-38 4-48 0z" fill="url(#mf-labios)" />
      <path d="M126 230c10 4 38 4 48 0" fill="none" stroke="#9e4256" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="150" cy="238" rx="9" ry="2.4" fill="#fff" opacity="0.35" />
      <path d="M146 214c1 4 1 7 0 10M154 214c-1 4-1 7 0 10" fill="none" stroke="#dcae9e" strokeWidth="0.9" opacity="0.8" />

      {/* cabelo da frente: risca no meio, preso para trás deixando a testa livre */}
      <path d="M70 146C62 76 100 26 150 26s88 50 80 120c-2-22-10-42-24-58-16-14-38-22-56-16-18-6-40 2-56 16-14 16-22 36-24 58z" fill="url(#mf-cabelo)" />
      <path d="M150 30c-18 8-34 22-46 44M150 30c18 8 34 22 46 44M147 33c-24 10-46 30-58 62M153 33c24 10 46 30 58 62M150 30v6" fill="none" stroke="#9a6d58" strokeWidth="1" opacity="0.55" strokeLinecap="round" />
    </g>
  )
}

export default function MapaFacial() {
  const { toast } = useToast()
  const patientId = usePatientId()
  const { id } = useParams()
  const demo = DEMO_DATA && isSeedPatient(id ? decodeURIComponent(id) : '')
  const [units, setUnits] = useState<Record<string, number>>(demo ? DEMO_UNITS : ZERO_UNITS)
  const [sel, setSel] = useState('testa')
  const total = Object.values(units).reduce((a, b) => a + b, 0)
  const set = (id: string, v: number) => setUnits((u) => ({ ...u, [id]: Math.max(0, v) }))

  useEffect(() => {
    if (!supabase || !patientId) return
    let cancelled = false
    supabase.from('facial_map').select('zone,units').eq('patient_id', patientId).then(({ data, error }) => {
      if (cancelled || error || !data || data.length === 0) return
      setUnits((u) => { const next = { ...u }; data.forEach((r) => { next[r.zone as string] = r.units as number }); return next })
    })
    return () => { cancelled = true }
  }, [patientId])

  const salvar = () => {
    if (supabase && patientId) {
      const rows = ZONES.map((z) => ({ patient_id: patientId, zone: z.id, units: units[z.id] ?? 0 }))
      supabase.from('facial_map').upsert(rows, { onConflict: 'patient_id,zone' }).then(({ error }) => { if (error) console.error('[supabase] facial_map', error.message) })
    }
    toast('Mapa de aplicação salvo.')
  }

  const zonaSel = ZONES.find((z) => z.id === sel)

  return (
    <div className="tab-body">
      <div className="home-cols">
        <section className="panel home-main mf-panel" aria-label="Mapa facial">
          <svg viewBox="0 0 300 380" className="mf-svg" role="img" aria-label={`Mapa de aplicação: ${ZONES.filter((z) => units[z.id] > 0).map((z) => `${z.label} ${units[z.id]}U`).join(', ') || 'nenhuma unidade'}`}>
            <Rosto />
            {ZONES.map((z) => {
              const u = units[z.id] ?? 0
              const on = u > 0
              const ativo = z.id === sel
              const lados = z.par ? [z.cx, 300 - z.cx] : [z.cx]
              return (
                <g key={z.id} className={`mf-zona${ativo ? ' sel' : ''}${on ? ' on' : ''}`} style={{ '--c': z.color } as React.CSSProperties}
                  role="button" tabIndex={0} aria-label={`${z.label}: ${u} unidades`} aria-pressed={ativo}
                  onClick={() => setSel(z.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(z.id) } }}>
                  {lados.map((cx) => (
                    <g key={cx}>
                      <ellipse cx={cx} cy={z.cy} rx={z.rx + 4} ry={z.ry + 4} className="mf-alvo" />
                      <ellipse cx={cx} cy={z.cy} rx={z.rx} ry={z.ry} className="mf-area" />
                      {pontos(z, u, cx).map(([x, y], k) => <circle key={k} cx={x} cy={y} r={2.2} className="mf-ponto" />)}
                    </g>
                  ))}
                </g>
              )
            })}
            {/* etiqueta só da zona escolhida, para não poluir o rosto */}
            {zonaSel && (
              <g className="mf-tag" style={{ '--c': zonaSel.color } as React.CSSProperties} pointerEvents="none">
                <rect x={zonaSel.cx - 52} y={zonaSel.cy - zonaSel.ry - 26} width={104} height={18} rx={9} />
                <text x={zonaSel.cx} y={zonaSel.cy - zonaSel.ry - 13.5} textAnchor="middle">{zonaSel.label} · {units[zonaSel.id] ?? 0}U</text>
              </g>
            )}
          </svg>
          <p className="o3d-hint">Toque numa zona para escolher · cada ponto ≈ 2U · D/E do paciente</p>
        </section>

        <aside className="home-aside wrap-row" style={{ gap: 14 }}>
          <section className="panel" aria-labelledby="mf-unidades">
            <div className="panel-head" style={{ marginBottom: 8 }}>
              <h2 id="mf-unidades" className="panel-title sm">Unidades por região</h2>
              <span className="mf-total">{total}U</span>
            </div>
            <div className="mf-lista">
              {ZONES.map((z) => (
                <div key={z.id} className="mf-row" aria-current={z.id === sel ? 'true' : undefined} onClick={() => setSel(z.id)}>
                  <span className="mf-dot" style={{ background: z.color }} />
                  <span className="mf-nome">{z.label}</span>
                  <div className="mf-step">
                    <button onClick={(e) => { e.stopPropagation(); set(z.id, units[z.id] - 2) }} aria-label={`Menos 2 unidades em ${z.label}`}>−</button>
                    <b>{units[z.id]}</b>
                    <button onClick={(e) => { e.stopPropagation(); set(z.id, units[z.id] + 2) }} aria-label={`Mais 2 unidades em ${z.label}`}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="kv-row"><span>Total de unidades</span><span>{total}U</span></div>
            <div className="kv-row"><span>Frascos estimados (50U)</span><span>{Math.ceil(total / 50) || 0}</span></div>
            <Button size="sm" block style={{ marginTop: 10 }} onClick={salvar}>Salvar mapa</Button>
          </section>
        </aside>
      </div>
    </div>
  )
}
