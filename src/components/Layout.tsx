import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '../icons'
import { confirmLeave } from '../lib/leaveGuard'
import { UserMenu } from './Chrome'
import { Onboarding, onboardingDone } from './Onboarding'
import { BRAND } from '../brand'

const NAV: { label: string; icon: IconName; to: string }[] = [
  { label: 'Dashboard', icon: 'home', to: '/' },
  { label: 'Agenda', icon: 'cal', to: '/agenda' },
  { label: 'Pacientes', icon: 'users', to: '/pacientes' },
  { label: 'CRM', icon: 'chat', to: '/crm' },
  { label: 'Financeiro', icon: 'pie', to: '/financeiro' },
  { label: 'Estoque', icon: 'box', to: '/estoque' },
  { label: 'Ficha de Procedimento', icon: 'clipboard', to: '/ficha-procedimento' },
  { label: 'Relatórios', icon: 'chart', to: '/relatorios' },
]

const BOTTOM: { label: string; icon: IconName; to: string }[] = [
  { label: 'Configurações', icon: 'gear', to: '/configuracoes' },
]

const STORAGE_KEY = 'gl-sidebar-expanded'

function readExpanded() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function GlLogo() {
  return <span className="gl-neon">GL</span>
}

function Sidebar({ expanded, onToggle, onHelp }: { expanded: boolean; onToggle: () => void; onHelp: () => void }) {
  const { pathname } = useLocation()
  const activeOverride = pathname.startsWith('/pacientes') ? '/pacientes' : null
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))

  const renderItem = (n: { label: string; icon: IconName; to: string }) => {
    const active = activeOverride ? n.to === activeOverride : isActive(n.to)
    return (
      <NavLink key={n.to} to={n.to} className={`nav-item${active ? ' active' : ''}`} data-tip={n.label} aria-label={n.label}
        onClick={(e) => { if (!confirmLeave()) e.preventDefault() }}>
        <Icon name={n.icon} size={21} />
        <span className="nav-label">{n.label}</span>
      </NavLink>
    )
  }

  return (
    <aside className={`sidebar${expanded ? ' expanded' : ''}`}>
      <div className="sidebar-head">
        <div className="sidebar-logo" title={BRAND.name}>
          <GlLogo />
        </div>
        <div className="sidebar-brand">
          <img src="/logo-gl.png" alt={`${BRAND.name} — ${BRAND.subtitle}`} className="sidebar-logo-full" />
        </div>
        <button className="sidebar-toggle" onClick={onToggle} aria-label={expanded ? 'Colapsar menu' : 'Expandir menu'} title={expanded ? 'Colapsar menu' : 'Expandir menu'}>
          <Icon name="chevron" size={18} />
        </button>
      </div>

      <nav>{NAV.map(renderItem)}</nav>
      <div className="sidebar-sep" />
      <nav>
        {BOTTOM.map(renderItem)}
        <button className="nav-item" data-tip="Ajuda" aria-label="Ajuda" onClick={onHelp}>
          <Icon name="help" size={21} />
          <span className="nav-label">Ajuda</span>
        </button>
      </nav>

      <div className="sidebar-user-row">
        <UserMenu />
        <div className="sidebar-user-meta">
          <div className="n">{BRAND.dentist}</div>
          <div className="r">{BRAND.role}</div>
        </div>
      </div>
    </aside>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(readExpanded)
  // abre sozinho no primeiro acesso; o botão Ajuda reabre quando quiser
  const [onboarding, setOnboarding] = useState(() => !onboardingDone())

  const toggle = () => {
    setExpanded((v) => {
      const next = !v
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <div className="app">
      <Sidebar expanded={expanded} onToggle={toggle} onHelp={() => setOnboarding(true)} />
      <div className="main">{children}</div>
      <Onboarding open={onboarding} onClose={() => setOnboarding(false)} />
    </div>
  )
}
