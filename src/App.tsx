import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'
import { StoreProvider } from './store'
import { GoogleProvider } from './lib/GoogleProvider'
import Dashboard from './pages/Dashboard'
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
  return (
    <div key={location.pathname} className="route-view fade-in">
      <Routes location={location}>
        <Route path="/" element={<Dashboard />} />
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

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <StoreProvider>
        <ToastProvider>
          <GoogleProvider>
            <Layout>
              <AnimatedRoutes />
            </Layout>
          </GoogleProvider>
        </ToastProvider>
      </StoreProvider>
    </BrowserRouter>
  )
}
