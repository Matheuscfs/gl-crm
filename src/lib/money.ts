/* Helpers de moeda (pt-BR) compartilhados. */

/** "R$ 1.234,56" → 1234.56 ; aceita number direto. */
export const parseMoney = (s: string | number): number => {
  if (typeof s === 'number') return s
  return Number(String(s).replace(/[^\d,-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')) || 0
}

/** 1234.5 → "R$ 1.234,50" */
export const brMoney = (n: number): string =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
