import { Suspense, lazy, type ComponentType, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'
import { ConfirmHost } from './components/confirm'
import { AvisoAtualizacao } from './components/AvisoAtualizacao'
import { StoreProvider } from './store'
import { GoogleProvider } from './lib/GoogleProvider'
import { AuthProvider, useAuth } from './lib/auth'
import Login, { NovaSenha, AcessoPendente } from './pages/Login'
import Dashboard from './pages/Dashboard'
import Resumo from './pages/Resumo'
import { useTablet } from './lib/useTablet'
import { SkeletonRows } from './components/States'

/**
 * Cada tela vem num pacote próprio, baixado na primeira visita (o service worker já guarda todos
 * para o modo offline). Se um deploy novo apagar o pacote antigo enquanto o app estava aberto,
 * a importação falha: recarrega uma vez para pegar a versão nova em vez de mostrar tela branca.
 */
function tela<T extends ComponentType>(carregar: () => Promise<{ default: T }>) {
  return lazy(() => carregar().then(
    (m) => { try { sessionStorage.removeItem('gl-recarregou') } catch { /* sem storage */ } return m },
    (e) => {
      let jaTentou = false
      try { jaTentou = sessionStorage.getItem('gl-recarregou') === '1'; sessionStorage.setItem('gl-recarregou', '1') } catch { /* sem storage */ }
      if (!jaTentou) window.location.reload()
      throw e
    },
  ))
}

const Agenda = tela(() => import('./pages/Agenda'))
const Pacientes = tela(() => import('./pages/Pacientes'))
const Patient = tela(() => import('./pages/Patient'))
const CRM = tela(() => import('./pages/CRM'))
const Financeiro = tela(() => import('./pages/Financeiro'))
const Estoque = tela(() => import('./pages/Estoque'))
const FichaProcedimento = tela(() => import('./pages/FichaProcedimento'))
const Relatorios = tela(() => import('./pages/Relatorios'))
const Configuracoes = tela(() => import('./pages/Configuracoes'))
const AgendarOnline = tela(() => import('./pages/AgendarOnline'))

/** Enquanto o pacote da tela chega: linhas-fantasma no lugar do conteúdo (sem pular o layout). */
function CarregandoTela() {
  return <div className="page-body" aria-busy="true" aria-label="Carregando"><SkeletonRows rows={6} /></div>
}

function AnimatedRoutes() {
  const location = useLocation()
  // no tablet a home é o Resumo (cartões grandes); no desktop, o Dashboard completo
  const tablet = useTablet()
  // na ficha, trocar de aba não remonta a página: o cabeçalho fica e só o conteúdo da aba troca
  const chave = location.pathname.replace(/^(\/pacientes\/[^/]+)\/.*$/, '$1')
  return (
    <div key={chave} className="route-view fade-in">
      <Suspense fallback={<CarregandoTela />}>
      <Routes location={location}>
        <Route path="/" element={tablet ? <Resumo /> : <Dashboard />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/pacientes" element={<Pacientes />} />
        <Route path="/pacientes/:id" element={<Navigate to="odontograma" replace />} />
        <Route path="/pacientes/:id/:tab" element={<Patient />} />
        <Route path="/crm" element={<CRM />} />
        <Route path="/financeiro" element={<Financeiro />} />
        <Route path="/estoque" element={<Estoque />} />
        <Route path="/ficha-procedimento" element={<FichaProcedimento />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </div>
  )
}

/**
 * Sem sessão, nada do CRM é montado — assim o store só busca dados do Supabase
 * com o usuário autenticado, e sair descarrega tudo da memória.
 */
function Gate({ children }: { children: ReactNode }) {
  const { session, loading, disabled, recuperando, situacao } = useAuth()
  if (disabled) return <>{children}</> // sem banco configurado: modo demonstração
  if (recuperando && session) return <NovaSenha /> // voltou pelo link de "esqueci a senha"
  if (loading || (session && situacao === null)) {
    return (
      <div className="login-bg">
        <div className="spinner" style={{ width: 26, height: 26, borderColor: 'rgba(63,107,245,.25)', borderTopColor: 'var(--primary)' }} />
      </div>
    )
  }
  if (!session) return <Login />
  // conta criada, mas o e-mail não está na equipe (migração 0027): nada do CRM carrega
  if (situacao === 'pendente') return <AcessoPendente />
  return <>{children}</>
}

/** /agendar é público (pedido de horário sem login); o resto do app passa pelo login. */
function Raiz() {
  const location = useLocation()
  if (location.pathname === '/agendar' || location.pathname.startsWith('/agendar/')) {
    return <Suspense fallback={<div className="login-bg"><div className="spinner" /></div>}><AgendarOnline /></Suspense>
  }
  return (
    <Gate>
      <StoreProvider>
        <GoogleProvider>
          <Layout>
            <AnimatedRoutes />
          </Layout>
        </GoogleProvider>
      </StoreProvider>
    </Gate>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ToastProvider>
          <Raiz />
          <ConfirmHost />
          <AvisoAtualizacao />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
