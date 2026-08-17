import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'
import { StoreProvider } from './store'
import { GoogleProvider } from './lib/GoogleProvider'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Resumo from './pages/Resumo'
import { useTablet } from './lib/useTablet'
import Agenda from './pages/Agenda'
import Pacientes from './pages/Pacientes'
import Patient from './pages/Patient'
import CRM from './pages/CRM'
import Financeiro from './pages/Financeiro'
import Estoque from './pages/Estoque'
import FichaProcedimento from './pages/FichaProcedimento'
import Relatorios from './pages/Relatorios'
import Configuracoes from './pages/Configuracoes'

function AnimatedRoutes() {
  const location = useLocation()
  // no tablet a home é o Resumo (cartões grandes); no desktop, o Dashboard completo
  const tablet = useTablet()
  return (
    <div key={location.pathname} className="route-view fade-in">
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
    </div>
  )
}

/**
 * Sem sessão, nada do CRM é montado — assim o store só busca dados do Supabase
 * com o usuário autenticado, e sair descarrega tudo da memória.
 */
function Gate({ children }: { children: ReactNode }) {
  const { session, loading, disabled } = useAuth()
  if (disabled) return <>{children}</> // sem banco configurado: modo demonstração
  if (loading) {
    return (
      <div className="login-bg">
        <div className="spinner" style={{ width: 26, height: 26, borderColor: 'rgba(63,107,245,.25)', borderTopColor: '#3f6bf5' }} />
      </div>
    )
  }
  if (!session) return <Login />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ToastProvider>
          <Gate>
            <StoreProvider>
              <GoogleProvider>
                <Layout>
                  <AnimatedRoutes />
                </Layout>
              </GoogleProvider>
            </StoreProvider>
          </Gate>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
