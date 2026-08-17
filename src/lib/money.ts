/* Helpers de moeda (pt-BR) compartilhados. */

/** "R$ 1.234,56" → 1234.56 ; aceita number direto. */
export const parseMoney = (s: string | number): number => {
  if (typeof s === 'number') return s
  return Number(String(s).replace(/[^\d,-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')) || 0
}

/** 1234.5 → "R$ 1.234,50" */
export const brMoney = (n: number): string =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/* ---------- Valor por extenso (recibos) ---------- */
const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const d = n % 100
  const partes: string[] = []
  if (c) partes.push(CENTENAS[c])
  if (d < 20 && d > 0) partes.push(UNIDADES[d])
  else if (d >= 20) {
    const dz = Math.floor(d / 10)
    const u = d % 10
    partes.push(u ? `${DEZENAS[dz]} e ${UNIDADES[u]}` : DEZENAS[dz])
  }
  return partes.join(' e ')
}

/** 1234.5 → "mil duzentos e trinta e quatro reais e cinquenta centavos" (para recibos). */
export function extenso(n: number): string {
  const abs = Math.abs(n)
  const inteiro = Math.floor(abs)
  const centavos = Math.round((abs - inteiro) * 100)
  const milhoes = Math.floor(inteiro / 1_000_000)
  const milhares = Math.floor((inteiro % 1_000_000) / 1000)
  const resto = inteiro % 1000
  const partes: string[] = []
  if (milhoes) partes.push(milhoes === 1 ? 'um milhão' : `${ate999(milhoes)} milhões`)
  if (milhares) partes.push(milhares === 1 ? 'mil' : `${ate999(milhares)} mil`)
  if (resto) partes.push(ate999(resto))
  const reais = inteiro ? `${partes.join(' ')} ${inteiro === 1 ? 'real' : 'reais'}` : ''
  const cent = centavos ? `${ate999(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}` : ''
  if (reais && cent) return `${reais} e ${cent}`
  return reais || cent || 'zero reais'
}
