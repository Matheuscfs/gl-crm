import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthCtx {
  session: Session | null
  /** Ainda verificando se existe sessão salva. */
  loading: boolean
  /** Sem Supabase configurado o app roda em modo demonstração, sem login. */
  disabled: boolean
  email: string
  /** Retorna a mensagem de erro, ou null em caso de sucesso. */
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  /** Envia o e-mail de redefinição de senha. Retorna mensagem de erro ou null. */
  resetPassword: (email: string) => Promise<string | null>
}

const Ctx = createContext<AuthCtx | null>(null)

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return v
}

/** Traduz os erros do Supabase para o que a recepção entende. */
function traduzErro(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'E-mail ainda não confirmado — confira a caixa de entrada.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Espere um minuto e tente de novo.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique a internet.'
  return msg
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!!supabase)

  useEffect(() => {
    const sb = supabase
    if (!sb) return
    let cancelled = false
    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = sb.auth.onAuthStateChange((_evt, s) => setSession(s))
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [])

  const value: AuthCtx = {
    session,
    loading,
    disabled: !supabase,
    email: session?.user?.email ?? '',
    signIn: async (email, password) => {
      if (!supabase) return null
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      return error ? traduzErro(error.message) : null
    },
    signOut: async () => {
      await supabase?.auth.signOut()
    },
    resetPassword: async (email) => {
      if (!supabase) return null
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
      return error ? traduzErro(error.message) : null
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
