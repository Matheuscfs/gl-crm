import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../icons'

const prefersReduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Anima um número de 0 (ou do valor anterior) até o alvo, com ease-out. */
function useCountUp(target: number, duration = 750): number {
  const [v, setV] = useState(() => (prefersReduced() ? target : 0))
  const prev = useRef(0)
  useEffect(() => {
    if (prefersReduced()) { setV(target); return }
    const from = prev.current
    prev.current = target
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setV(from + (target - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}

/**
 * Renderiza um valor já formatado ("R$ 38.420,50", "05", "12%") animando a
 * contagem de 0 até o número, preservando prefixo/sufixo, casas decimais,
 * separador de milhar e zeros à esquerda.
 */
export function CountUp({ value }: { value: string }) {
  const m = /-?[\d.]*\d(?:,\d+)?/.exec(value)
  const raw = m ? Number(m[0].replace(/\./g, '').replace(',', '.')) : NaN
  const target = Number.isFinite(raw) ? raw : 0
  const v = useCountUp(target)
  if (!m || !Number.isFinite(raw)) return <>{value}</>
  const decimals = m[0].includes(',') ? m[0].split(',')[1].length : 0
  const grouped = m[0].includes('.')
  let num = v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped })
  if (!grouped && /^0\d/.test(m[0])) {
    const intLen = m[0].split(',')[0].length
    const [i, d] = num.split(',')
    num = i.padStart(intLen, '0') + (d ? `,${d}` : '')
  }
  return <>{value.slice(0, m.index)}{num}{value.slice(m.index + m[0].length)}</>
}

export function StatCard({
  label,
  value,
  sub,
  tone,
  valueColor,
  borderColor,
}: {
  label: string
  value: string
  sub: string
  tone: string
  valueColor?: string
  borderColor?: string
}) {
  return (
    <div className="card card-hover" style={{ padding: '17px 18px 15px', borderColor }}>
      <div style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#8a9699' }}>{label}</div>
      <div
        className="tnum"
        style={{ font: "800 26px 'Plus Jakarta Sans'", color: valueColor ?? '#1a2426', margin: '8px 0 6px' }}
      >
        <CountUp value={value} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: tone }} />
        <span style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: valueColor ? '#a81e1e' : '#5b6a6d' }}>{sub}</span>
      </div>
    </div>
  )
}

export function Pill({
  children,
  bg,
  fg,
  border,
  style,
}: {
  children: ReactNode
  bg: string
  fg: string
  border?: string
  style?: CSSProperties
}) {
  return (
    <span className="pill" style={{ background: bg, color: fg, border: border ? `1px solid ${border}` : undefined, ...style }}>
      {children}
    </span>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div style={{ font: "800 15px 'Plus Jakarta Sans'", color: '#1a2426', marginBottom: 12 }}>{children}</div>
}

export function WaButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      className="chip"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        font: "700 11px 'Plus Jakarta Sans'",
        color: '#2f52e0',
        background: '#e9eeff',
        padding: '5px 10px',
        borderRadius: 9,
      }}
    >
      <Icon name="wa" size={15} /> {children}
    </button>
  )
}
