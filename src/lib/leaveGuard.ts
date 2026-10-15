import { useEffect, type MouseEvent } from 'react'
import { pedirConfirmacao } from '../components/confirm'

let activeMsg: string | null = null

/**
 * Pergunta (na confirmação do app) se pode sair quando há dados não salvos.
 * Resolve true quando a navegação pode seguir.
 */
export function podeSair(): Promise<boolean> {
  if (!activeMsg) return Promise.resolve(true)
  return pedirConfirmacao({ title: 'Sair sem salvar?', message: activeMsg, confirmLabel: 'Sair sem salvar', cancelLabel: 'Continuar editando', danger: true })
}

/** Navegação por código: só executa `ir` se não houver pendência ou se a pessoa confirmar. */
export function sairSePuder(ir: () => void | Promise<void>) {
  podeSair().then((ok) => { if (ok) void ir() })
}

/**
 * Para o onClick de um link: sem pendência o link segue normalmente;
 * com pendência, segura o clique, pergunta e só então chama `ir`.
 */
export function guardarLink(e: MouseEvent, ir: () => void) {
  if (!activeMsg) return
  e.preventDefault()
  sairSePuder(ir)
}

/**
 * Enquanto `dirty` for true: fechar/atualizar a aba dispara o aviso nativo do
 * navegador (o único que o navegador permite ali), e a navegação interna
 * (menu, abas do paciente) passa a perguntar antes via podeSair().
 */
export function useLeaveGuard(dirty: boolean, message = 'Você tem dados não salvos — ao sair eles serão perdidos.') {
  useEffect(() => {
    if (!dirty) return
    activeMsg = message
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      activeMsg = null
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [dirty, message])
}
