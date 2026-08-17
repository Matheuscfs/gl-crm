import { useEffect, useState } from 'react'

/** Reage a uma media query (SSR-safe o suficiente para o app). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}

/**
 * Modo tablet/celular — o app troca o rail lateral pelo shell estilo Apple Health
 * (título grande, cartões arredondados e tab bar embaixo).
 * O limite de 1180px cobre iPad em retrato e paisagem.
 */
export const useTablet = () => useMediaQuery('(max-width: 1180px)')
