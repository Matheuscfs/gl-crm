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
  return (
    <div
      className={`tooth-col${selected ? ' tooth-selected' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: onClick ? 'pointer' : undefined, opacity: dim ? 0.28 : 1, transition: 'opacity 0.2s ease' }}
      onClick={onClick ? () => onClick(tooth.num) : undefined}
    >
      {upper ? (<>{svg}{numEl}</>) : (<>{numEl}{svg}</>)}
    </div>
  )
}
