/* Horários de atendimento da clínica — parsing e faixa de expediente por dia. */
import { parseISO } from './dates'

export interface HorarioDia {
  day: string
  hours: string
  closed: boolean
}

/** Faixa de expediente do dia. null = fechado. */
export type Range = { start: number; end: number } | null

const DAY_ORD = [6, 0, 1, 2, 3, 4, 5] // getDay() 0=Dom..6=Sáb → índice Segunda=0..Domingo=6

export function dayRange(horarios: HorarioDia[], iso: string): Range {
  const h = horarios[DAY_ORD[parseISO(iso).getDay()]]
  if (!h || h.closed) return null
  const m = h.hours.match(/(\d{1,2})(?::(\d{2}))?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?/)
  if (!m) return null
  const s = Number(m[1]) + Number(m[2] ?? 0) / 60
  const e = Number(m[3]) + Number(m[4] ?? 0) / 60
  return e > s ? { start: s, end: e } : null
}
