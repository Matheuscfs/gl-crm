/* Formatação e parsing de valores numéricos (dinheiro e duração). */

/** 180 → "R$ 180,00" */
export const fmtMoney = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Um só parser de dinheiro para o app inteiro (entende "180.50" do teclado do tablet). */
export { parseMoney } from './money'

/** 40 → "40 min" · 60 → "1h" · 90 → "1h30" */
export const fmtDur = (min: number) => {
  const m = Math.max(0, Math.round(min || 0))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h}h${String(rest).padStart(2, '0')}` : `${h}h`
}

/** "40 min" / "1h30" / "40" → minutos. 0 se inválido. */
export const parseDurMin = (s: string | null | undefined) => {
  if (!s) return 0
  const str = String(s).toLowerCase()
  const hMatch = str.match(/(\d+)\s*h\s*(\d+)?/)
  if (hMatch) return Number(hMatch[1]) * 60 + Number(hMatch[2] ?? 0)
  const n = Number((str.match(/\d+/) || [])[0])
  return Number.isFinite(n) ? n : 0
}
