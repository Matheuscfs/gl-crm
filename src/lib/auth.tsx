import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Situação da conta logada: na equipe (com ou sem administração) ou aguardando liberação. */
export type Situacao = 'admin' | 'equipe' | 'pendente'

interface AuthCtx {
  session: Session | null
  /** Ainda verificando se existe sessão salva. */
  loading: boolean
  /** Sem Supabase configurado o app roda em modo demonstração, sem login. */
  disabled: boolean
  email: string
  /** Acesso da conta (migração 0027). null enquanto confere. */
  situacao: Situacao | null
  /** Confere de novo (ex.: "já fui liberada"). */
  conferirAcesso: () => Promise<void>
  /** Voltou pelo link de "esqueci a senha": precisa definir a nova antes de entrar. */
  recuperando: boolean
  /** Retorna a mensagem de erro, ou null em caso de sucesso. */
  signIn: (email: string, password: string) => Promise<string | null>
  /** Cria a conta. `confirmar` = o Supabase mandou e-mail de confirmação antes de liberar o login. */
  signUp: (nome: string, email: string, password: string) => Promise<{ erro: string | null; confirmar: boolean }>
  signOut: () => Promise<void>
  /** Envia o e-mail de redefinição de senha. Retorna mensagem de erro ou null. */
  resetPassword: (email: string) => Promise<string | null>
  /** Grava a nova senha (depois do link de recuperação). */
  updatePassword: (password: string) => Promise<string | null>
}

const Ctx = createContext<AuthCtx | null>(null)

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return v
}

/** Traduz os erros do Supabase para o que a recepção entende. */
export function traduzErro(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'E-mail ainda não confirmado — confira a caixa de entrada.'
  if (m.includes('user already registered') || m.includes('already been registered')) return 'Já existe uma conta com este e-mail. Use "Entrar" ou "Esqueceu a senha?".'
  if (m.includes('password should be at least') || m.includes('weak password')) return 'Senha fraca: use pelo menos 8 caracteres, com letras e números.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'O cadastro de novas contas está desligado. Peça à clínica para criar o seu acesso.'
  if (m.includes('same password') || m.includes('should be different')) return 'A nova senha precisa ser diferente da anterior.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Espere um minuto e tente de novo.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique a internet.'
  return msg
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!!supabase)
  const [situacao, setSituacao] = useState<Situacao | null>(null)
  // o link do e-mail de recuperação chega com "type=recovery" no endereço
  const [recuperando, setRecuperando] = useState(() => typeof window !== 'undefined' && /type=recovery/.test(window.location.hash))

  useEffect(() => {
    const sb = supabase
    if (!sb) return
    let cancelled = false
    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = sb.auth.onAuthStateChange((evt, s) => {
      setSession(s)
      if (evt === 'PASSWORD_RECOVERY') setRecuperando(true)
      if (evt === 'SIGNED_OUT') { setSituacao(null); setRecuperando(false) }
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [])

  const conferirAcesso = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.rpc('minha_situacao')
    // banco sem a migração 0027: vale o modelo antigo (todo usuário logado é equipe)
    if (error) { setSituacao('equipe'); return }
    setSituacao((data as Situacao) ?? 'pendente')
  }, [])

  // Re-check access when the signed-in user changes, not on every token refresh.
  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) { setSituacao(null); return }
    void conferirAcesso()
  }, [userId, conferirAcesso])

  const value: AuthCtx = {
    session,
    loading,
    disabled: !supabase,
    email: session?.user?.email ?? '',
    situacao,
    conferirAcesso,
    recuperando,
    signIn: async (email, password) => {
      if (!supabase) return null
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      return error ? traduzErro(error.message) : null
    },
    signUp: async (nome, email, password) => {
      if (!supabase) return { erro: null, confirmar: false }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { nome: nome.trim() }, emailRedirectTo: window.location.origin },
      })
      if (error) return { erro: traduzErro(error.message), confirmar: false }
      return { erro: null, confirmar: !data.session }
    },
    signOut: async () => {
      await supabase?.auth.signOut()
    },
    resetPassword: async (email) => {
      if (!supabase) return null
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
      return error ? traduzErro(error.message) : null
    },
    updatePassword: async (password) => {
      if (!supabase) return null
      const { error } = await supabase.auth.updateUser({ password })
      if (error) return traduzErro(error.message)
      setRecuperando(false)
      // limpa o "#access_token…type=recovery" do endereço
      if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search)
      return null
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
