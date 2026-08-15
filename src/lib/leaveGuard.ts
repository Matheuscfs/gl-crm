import { useEffect } from 'react'

let activeMsg: string | null = null

/**
 * Consulta o guard ativo antes de navegar. Retorna true quando a navegação
 * pode seguir (sem dados pendentes, ou o usuário confirmou o descarte).
 */
export function confirmLeave(): boolean {
  return !activeMsg || window.confirm(activeMsg)
}

/**
 * Enquanto `dirty` for true: fechar/atualizar a aba dispara o aviso nativo do
 * navegador, e a navegação interna (sidebar, abas do paciente) passa a pedir
 * confirmação via confirmLeave().
 */
export function useLeaveGuard(dirty: boolean, message = 'Você tem dados não salvos — ao sair eles serão perdidos. Sair mesmo assim?') {
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
