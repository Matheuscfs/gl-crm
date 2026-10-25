import { useEffect, useState } from 'react'

/** Faixa "Nova versão disponível" — atualiza quando a pessoa tocar (nada se perde no meio de um cadastro). */
export function AvisoAtualizacao() {
  const [atualizar, setAtualizar] = useState<null | (() => void)>(null)
  useEffect(() => {
    const ouvir = (e: Event) => setAtualizar(() => (e as CustomEvent<() => void>).detail)
    window.addEventListener('gl-nova-versao', ouvir)
    return () => window.removeEventListener('gl-nova-versao', ouvir)
  }, [])
  if (!atualizar) return null
  return (
    <div className="aviso-versao" role="status" aria-live="polite">
      <span>Nova versão do GL CRM disponível.</span>
      <button className="btn-cta sm" onClick={() => atualizar()}>Atualizar</button>
      <button className="aviso-versao-x" aria-label="Agora não" onClick={() => setAtualizar(null)}>×</button>
    </div>
  )
}
