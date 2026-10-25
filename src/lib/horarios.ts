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

// 08:00 – 18:00 · 8h às 18h · 8h30-17h · 8 a 12
const RANGE = /(\d{1,2})(?:[:h](\d{2})?)?\s*(?:[–—-]|às|as|a)\s*(\d{1,2})(?:[:h](\d{2})?)?/gi
const hour = (h: string, m?: string) => Number(h) + Number(m ?? 0) / 60

/**
 * O horário é texto livre ("08:00 – 18:00"). Com intervalo de almoço ("08:00 – 12:00 / 14:00 – 18:00")
 * a faixa vai da primeira abertura ao último fechamento — antes só a manhã contava e a agenda
 * recusava qualquer horário à tarde.
 */
export function dayRange(horarios: HorarioDia[], iso: string): Range {
  const h = horarios[DAY_ORD[parseISO(iso).getDay()]]
  if (!h || h.closed) return null
  const faixas = [...h.hours.matchAll(RANGE)].map((m) => ({ start: hour(m[1], m[2]), end: hour(m[3], m[4]) })).filter((f) => f.end > f.start)
  if (faixas.length === 0) return null
  return { start: Math.min(...faixas.map((f) => f.start)), end: Math.max(...faixas.map((f) => f.end)) }
}
