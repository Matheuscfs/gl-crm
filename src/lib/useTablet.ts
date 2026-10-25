import { useEffect, useState } from 'react'

/*
 * Na impressão a página é diagramada na largura da folha A4: as media queries de largura
 * mudam no meio e o app trocava de layout (desktop ↔ tablet), desmontando o documento aberto —
 * a folha saía em branco. Enquanto imprime, os valores ficam congelados; no fim, relê.
 */
let imprimindo = false
const FIM_IMPRESSAO = 'gl-fim-impressao'
if (typeof window !== 'undefined') {
  window.addEventListener('beforeprint', () => { imprimindo = true })
  window.addEventListener('afterprint', () => { imprimindo = false; window.dispatchEvent(new Event(FIM_IMPRESSAO)) })
}
const emImpressao = () => imprimindo || window.matchMedia('print').matches

/** Reage a uma media query (SSR-safe o suficiente para o app); não muda durante a impressão. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => { if (!emImpressao()) setMatches(mq.matches) }
    on()
    mq.addEventListener('change', on)
    window.addEventListener(FIM_IMPRESSAO, on)
    return () => {
      mq.removeEventListener('change', on)
      window.removeEventListener(FIM_IMPRESSAO, on)
    }
  }, [query])
  return matches
}

/**
 * Modo tablet/celular — o app troca o rail lateral pelo shell estilo Apple Health
 * (título grande, cartões arredondados e tab bar embaixo).
 * O limite de 1180px cobre iPad em retrato e paisagem.
 */
export const useTablet = () => useMediaQuery('(max-width: 1180px)')
