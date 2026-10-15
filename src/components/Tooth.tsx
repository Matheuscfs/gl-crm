import { TOOTH, type ToothState, type ToothItem } from '../data'

type Size = 'lg' | 'mini' | 'sm'

const DIMS: Record<Size, { w: number; h: number; font: number }> = {
  lg: { w: 32, h: 38, font: 13 },
  sm: { w: 26, h: 30, font: 11 },
  mini: { w: 22, h: 24, font: 10 },
}

/* ---------- Simple box teeth (legend + deciduous reference) ---------- */

export function ToothBox({ state, size = 'lg', selected = false }: { state: ToothState; size?: Size; selected?: boolean }) {
  const t = TOOTH[state]
  const d = DIMS[size]
  return (
    <div
      style={{
        width: d.w,
        height: d.h,
        borderRadius: 7,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: `700 ${d.font}px/1 var(--font)`,
        background: t.bg,
        color: t.fg,
        border: `1.5px ${t.dashed ? 'dashed' : 'solid'} ${t.border}`,
        boxShadow: selected ? '0 0 0 2.5px var(--primary)' : undefined,
      }}
    >
      {t.glyph}
    </div>
  )
}

export function ToothCol({
  tooth,
  numOnTop,
  size = 'lg',
  selected,
  onClick,
}: {
  tooth: ToothItem
  numOnTop: boolean
  size?: Size
  selected?: boolean
  onClick?: (num: number) => void
}) {
  const numEl = <div style={{ font: `700 ${size === 'lg' ? 10 : 8}px var(--mono)`, color: 'var(--muted)' }}>{tooth.num}</div>
  const box = <ToothBox state={tooth.state} size={size} selected={selected} />
  return (
    <div
      className={onClick ? 'tooth-col' : undefined}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size === 'lg' ? 5 : 3, cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick ? () => onClick(tooth.num) : undefined}
    >
      {numOnTop ? (<>{box}{numEl}</>) : (<>{numEl}{box}</>)}
    </div>
  )
}

/* ---------- Anatomical SVG teeth ---------- */

type Kind = 'incisor' | 'canine' | 'molar'

function kindOf(num: number): Kind {
  const d = num % 10
  if (d === 1 || d === 2) return 'incisor'
  if (d === 3) return 'canine'
  return 'molar'
}

// silhouettes drawn crown-up in a 40x56 viewBox
const PATHS: Record<Kind, string> = {
  incisor:
    'M13 5 Q13 2 16 2 L24 2 Q27 2 27 5 L26 20 Q26 24 24 26 L23 45 Q20 51 17 45 L16 26 Q14 24 14 20 Z',
  canine:
    'M14 8 Q14 3 20 2 Q26 3 26 8 L25 21 Q25 25 23 26 L22 47 Q20 53 18 47 L17 26 Q15 25 15 21 Z',
  molar:
    'M7 8 Q7 2 13 2 L27 2 Q33 2 33 8 L33 20 Q33 24 30 25 L28 46 Q27 51 24 47 Q21 42 20 42 Q19 42 16 47 Q13 51 12 46 L10 25 Q7 24 7 20 Z',
}

export function AnatomicalTooth({
  tooth,
  upper,
  selected = false,
  width = 34,
  dim = false,
  onClick,
}: {
  tooth: ToothItem
  upper: boolean
  selected?: boolean
  width?: number
  dim?: boolean
  onClick?: (num: number) => void
}) {
  const t = TOOTH[tooth.state]
  const kind = kindOf(tooth.num)
  const h = Math.round(width * 1.4)
  const numEl = (
    <div style={{ font: "700 10px var(--mono)", color: selected ? 'var(--primary-dark)' : '#8b93a7' }}>{tooth.num}</div>
  )
  const svg = (
    <svg width={width} height={h} viewBox="0 0 40 56" style={{ display: 'block', overflow: 'visible' }}>
      <g transform={upper ? 'translate(0,56) scale(1,-1)' : undefined}>
        <path
          d={PATHS[kind]}
          fill={t.fill}
          stroke={selected ? '#5b2196' : t.stroke}
          strokeWidth={selected ? 2.4 : 1.6}
          strokeDasharray={t.dashed ? '3 2.5' : undefined}
          strokeLinejoin="round"
          style={{ transition: 'fill 0.2s ease, stroke 0.2s ease' }}
        />
        {tooth.state === 'selante' && <circle cx="20" cy="14" r="3.4" fill={t.marker} />}
        {tooth.state === 'extraido' && (
          <path d="M13 9 L27 21 M27 9 L13 21" stroke={t.marker} strokeWidth="2.2" strokeLinecap="round" />
        )}
      </g>
    </svg>
  )
  // clicável vira botão de verdade: Tab chega em cada dente e Enter/Espaço seleciona
  const interativo = onClick
    ? {
        role: 'button' as const, tabIndex: 0, 'aria-pressed': selected,
        'aria-label': `Dente ${tooth.num}: ${t.label}`,
        onClick: () => onClick(tooth.num),
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(tooth.num) } },
      }
    : {}
  return (
    <div
      className={`tooth-col${selected ? ' tooth-selected' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: onClick ? 'pointer' : undefined, opacity: dim ? 0.28 : 1, transition: 'opacity 0.2s ease' }}
      {...interativo}
    >
      {upper ? (<>{svg}{numEl}</>) : (<>{numEl}{svg}</>)}
    </div>
  )
}

/* ---------- Faces do dente (M, D, O/I, V, L/P) ---------- */

export type Face = 'V' | 'L' | 'M' | 'D' | 'O'
export type Faces = Partial<Record<Face, ToothState>>

/** Rótulo da face conforme o dente: incisal nos anteriores, palatina na arcada superior. */
export function rotuloFace(f: Face, num: number): string {
  const anterior = [1, 2, 3].includes(num % 10)
  const superior = [1, 2, 5, 6].includes(Math.floor(num / 10))
  return { V: 'V', L: superior ? 'P' : 'L', M: 'M', D: 'D', O: anterior ? 'I' : 'O' }[f]
}
const NOME_FACE: Record<string, string> = { V: 'vestibular', L: 'lingual', P: 'palatina', M: 'mesial', D: 'distal', O: 'oclusal', I: 'incisal' }
export const nomeFace = (f: Face, num: number) => NOME_FACE[rotuloFace(f, num)]

/**
 * Diagrama clássico de 5 faces. Esquerda/direita da tela = mesial/distal conforme o lado
 * (dentes do lado direito do paciente ficam à esquerda da tela, com a mesial voltada ao centro);
 * em cima a vestibular na arcada superior e a lingual na inferior (como o dente aparece na arcada).
 */
export function FaceDiagram({ num, faces, size = 120, onFace }: { num: number; faces: Faces; size?: number; onFace?: (f: Face) => void }) {
  const q = Math.floor(num / 10)
  const ladoDireitoPaciente = [1, 4, 5, 8].includes(q)
  const superior = [1, 2, 5, 6].includes(q)
  const esq: Face = ladoDireitoPaciente ? 'D' : 'M'
  const dir: Face = ladoDireitoPaciente ? 'M' : 'D'
  const cima: Face = superior ? 'V' : 'L'
  const baixo: Face = superior ? 'L' : 'V'
  const regioes: { f: Face; d: string; lx: number; ly: number }[] = [
    { f: cima, d: 'M2 2 L58 2 L42 18 L18 18 Z', lx: 30, ly: 11 },
    { f: baixo, d: 'M18 42 L42 42 L58 58 L2 58 Z', lx: 30, ly: 52 },
    { f: esq, d: 'M2 2 L18 18 L18 42 L2 58 Z', lx: 9, ly: 31 },
    { f: dir, d: 'M42 18 L58 2 L58 58 L42 42 Z', lx: 51, ly: 31 },
    { f: 'O', d: 'M18 18 L42 18 L42 42 L18 42 Z', lx: 30, ly: 31 },
  ]
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" role="group" aria-label={`Faces do dente ${num}`} style={{ display: 'block' }}>
      {regioes.map((r) => {
        const st = faces[r.f]
        const cor = st ? TOOTH[st] : null
        return (
          <g key={r.f}
            role={onFace ? 'button' : undefined} tabIndex={onFace ? 0 : undefined}
            aria-label={`Face ${nomeFace(r.f, num)}${cor ? `: ${cor.label}` : ''}`}
            onClick={onFace ? () => onFace(r.f) : undefined}
            onKeyDown={onFace ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFace(r.f) } } : undefined}
            className={onFace ? 'face-reg' : undefined}>
            <path d={r.d} fill={cor ? cor.marker : 'var(--surface)'} fillOpacity={cor ? 0.85 : 1} stroke="var(--border-strong)" strokeWidth={1.2} strokeLinejoin="round" />
            <text x={r.lx} y={r.ly + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill={cor ? '#fff' : 'var(--muted)'} style={{ pointerEvents: 'none' }}>{rotuloFace(r.f, num)}</text>
          </g>
        )
      })}
    </svg>
  )
}
