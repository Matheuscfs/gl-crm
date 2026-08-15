import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon } from '../icons'
import { brDate, parseBr, maskBr, todayISO, parseISO } from '../lib/dates'
import { useOutsideClick } from './useOutsideClick'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const pad = (n: number) => String(n).padStart(2, '0')

const navBtn: CSSProperties = { width: 30, height: 30, border: 'none', borderRadius: 8, background: 'transparent', color: '#5b647a', font: "700 17px 'Plus Jakarta Sans'", cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const titleBtn: CSSProperties = { flex: 1, height: 30, border: 'none', borderRadius: 8, background: 'transparent', color: '#26324a', font: "800 13px 'Plus Jakarta Sans'", cursor: 'pointer' }

/**
 * Calendário em três níveis (estilo Airbnb): dias → clique no título abre a grade
 * de meses → clique no ano abre a grade de anos. Setas navegam em qualquer nível.
 */
function Calendar({ value, onPick }: { value: string; onPick: (iso: string) => void }) {
  const base = parseISO(value || todayISO())
  const [view, setView] = useState<'dias' | 'meses' | 'anos'>('dias')
  const [y, setY] = useState(base.getFullYear())
  const [m, setM] = useState(base.getMonth())
  const hoje = parseISO(todayISO())
  const sel = value ? parseISO(value) : null

  const anosBase = Math.floor(y / 12) * 12
  const prev = () => {
    if (view === 'dias') { if (m === 0) { setM(11); setY(y - 1) } else setM(m - 1) }
    else if (view === 'meses') setY(y - 1)
    else setY(y - 12)
  }
  const next = () => {
    if (view === 'dias') { if (m === 11) { setM(0); setY(y + 1) } else setM(m + 1) }
    else if (view === 'meses') setY(y + 1)
    else setY(y + 12)
  }
  const title = view === 'dias' ? `${MESES[m]} ${y}` : view === 'meses' ? String(y) : `${anosBase} – ${anosBase + 11}`
  const drill = () => setView(view === 'dias' ? 'meses' : 'anos')

  const cell = (opts: { k: string; label: string | number; selected?: boolean; today?: boolean; muted?: boolean; onClick: () => void; h?: number }) => (
    <button
      key={opts.k}
      onClick={opts.onClick}
      style={{
        height: opts.h ?? 32, border: opts.today && !opts.selected ? '1px solid #cdd8ff' : 'none', borderRadius: 9, cursor: 'pointer',
        background: opts.selected ? '#3f6bf5' : 'transparent',
        color: opts.selected ? '#fff' : opts.today ? '#2f52e0' : opts.muted ? '#aeb7c8' : '#26324a',
        font: `${opts.selected ? 700 : 600} 12.5px 'Plus Jakarta Sans'`,
      }}
      onMouseEnter={(e) => { if (!opts.selected) e.currentTarget.style.background = '#eef2f9' }}
      onMouseLeave={(e) => { if (!opts.selected) e.currentTarget.style.background = 'transparent' }}
    >
      {opts.label}
    </button>
  )

  const primeiroDia = new Date(y, m, 1).getDay()
  const nDias = new Date(y, m + 1, 0).getDate()

  return (
    <div className="menu-pop" style={{ left: 0, width: 268, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <button style={navBtn} onClick={prev} aria-label="Anterior">‹</button>
        <button style={titleBtn} onClick={drill} title={view === 'dias' ? 'Escolher mês' : view === 'meses' ? 'Escolher ano' : undefined}>{title}</button>
        <button style={navBtn} onClick={next} aria-label="Próximo">›</button>
      </div>

      {view === 'dias' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
            {SEMANA.map((d, i) => (
              <span key={i} style={{ textAlign: 'center', font: "700 10.5px 'Plus Jakarta Sans'", color: '#8b93a7', padding: '4px 0' }}>{d}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: primeiroDia }, (_, i) => <span key={`b${i}`} />)}
            {Array.from({ length: nDias }, (_, i) => {
              const d = i + 1
              return cell({
                k: `d${d}`,
                label: d,
                selected: !!sel && sel.getFullYear() === y && sel.getMonth() === m && sel.getDate() === d,
                today: hoje.getFullYear() === y && hoje.getMonth() === m && hoje.getDate() === d,
                onClick: () => onPick(`${y}-${pad(m + 1)}-${pad(d)}`),
              })
            })}
          </div>
        </>
      )}

      {view === 'meses' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {MESES_ABBR.map((nome, i) => cell({
            k: `m${i}`, label: nome, h: 40,
            selected: !!sel && sel.getFullYear() === y && sel.getMonth() === i,
            today: hoje.getFullYear() === y && hoje.getMonth() === i,
            onClick: () => { setM(i); setView('dias') },
          }))}
        </div>
      )}

      {view === 'anos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {Array.from({ length: 12 }, (_, i) => {
            const ano = anosBase + i
            return cell({
              k: `a${ano}`, label: ano, h: 40,
              selected: !!sel && sel.getFullYear() === ano,
              today: hoje.getFullYear() === ano,
              onClick: () => { setY(ano); setView('meses') },
            })
          })}
        </div>
      )}
    </div>
  )
}

/** Campo de data dd/mm/aaaa com máscara + calendário próprio em pt-BR. Valor interno em ISO (aaaa-mm-dd). */
export function DateField({ value, onChange, autoFocus }: { value: string; onChange: (iso: string) => void; autoFocus?: boolean }) {
  const [text, setText] = useState(() => brDate(value))
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)
  useEffect(() => { setText(brDate(value)) }, [value])
  const onText = (v: string) => {
    const masked = maskBr(v)
    setText(masked)
    const iso = parseBr(masked)
    if (iso) onChange(iso)
    else if (!masked) onChange('')
  }
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className="field-input"
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder="dd/mm/aaaa"
        value={text}
        onChange={(e) => onText(e.target.value)}
        onBlur={() => { if (text && !parseBr(text)) setText(brDate(value)) }}
        style={{ paddingRight: 34, width: '100%' }}
      />
      <button type="button" onClick={() => setOpen((v) => !v)} title="Abrir calendário" aria-label="Abrir calendário"
        style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: open ? '#3f6bf5' : '#8b93a7', cursor: 'pointer' }}>
        <Icon name="cal" size={16} />
      </button>
      {open && <Calendar value={value} onPick={(iso) => { onChange(iso); setOpen(false) }} />}
    </div>
  )
}
