import { useEffect, useState } from 'react'

/** Preferência de aparência: fixa em claro/escuro ou acompanha o sistema (como no iPhone/Mac). */
export type TemaPref = 'claro' | 'escuro' | 'auto'

const KEY = 'gl-theme'
const EVENTO = 'gl-theme-change'
const COR_BARRA = { light: '#f6f5f9', dark: '#121016' }

export function lerTema(): TemaPref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'escuro' || v === 'auto' ? v : 'claro'
  } catch {
    return 'claro'
  }
}

const sistemaEscuro = () => window.matchMedia('(prefers-color-scheme: dark)').matches

/** Aplica no <html> (data-theme) e na cor da barra do navegador/app instalado. */
export function aplicarTema(pref: TemaPref) {
  const modo = pref === 'escuro' || (pref === 'auto' && sistemaEscuro()) ? 'dark' : 'light'
  document.documentElement.dataset.theme = modo
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[modo])
}

/** Preferência atual + função para trocar; todas as telas que usam o hook ficam em sincronia. */
export function useTema(): [TemaPref, (p: TemaPref) => void] {
  const [pref, setPref] = useState<TemaPref>(lerTema)

  useEffect(() => {
    const sync = () => setPref(lerTema())
    window.addEventListener(EVENTO, sync)
    return () => window.removeEventListener(EVENTO, sync)
  }, [])

  // no automático, acompanha a troca do sistema (ex.: o iPad escurece à noite)
  useEffect(() => {
    if (pref !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => aplicarTema('auto')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [pref])

  const trocar = (p: TemaPref) => {
    try { localStorage.setItem(KEY, p) } catch { /* sem armazenamento: vale só nesta aba */ }
    aplicarTema(p)
    setPref(p)
    window.dispatchEvent(new Event(EVENTO))
  }
  return [pref, trocar]
}
