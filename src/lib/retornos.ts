import type { Patient } from '../data'
import { diffDays, parseBr, todayISO } from './dates'

/**
 * Retorno vencido é calculado pela data do próximo retorno, todo dia — antes dependia
 * do campo `late`, que nenhuma tela grava, e por isso paciente real nunca aparecia.
 * O `late` só vale para cadastros antigos em que o retorno foi escrito como texto livre.
 *
 * Devolve há quantos dias venceu (0 = vencido sem data conhecida) ou null se está em dia.
 */
export function diasDeRetornoVencido(p: Patient, hoje: string = todayISO()): number | null {
  const iso = parseBr(p.next ?? '')
  if (iso) return iso < hoje ? diffDays(iso, hoje) : null
  return p.late ? 0 : null
}

export const retornoVencido = (p: Patient, hoje?: string) => diasDeRetornoVencido(p, hoje) !== null

/** "vencido há 22 dias" / "vencido" — para listas e avisos. */
export function rotuloRetornoVencido(dias: number): string {
  if (dias <= 0) return 'Retorno vencido'
  return `Vencido há ${dias} dia${dias === 1 ? '' : 's'}`
}
