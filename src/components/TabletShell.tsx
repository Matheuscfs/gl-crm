import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../icons'
import { confirmLeave } from '../lib/leaveGuard'
import { BRAND } from '../brand'

interface Item { label: string; icon: IconName; to: string }

/** Abas fixas da barra inferior — o resto entra em "Mais". */
const TABS: Item[] = [
  { label: 'Resumo', icon: 'home', to: '/' },
  { label: 'Agenda', icon: 'cal', to: '/agenda' },
  { label: 'Pacientes', icon: 'users', to: '/pacientes' },
  { label: 'Estoque', icon: 'box', to: '/estoque' },
]

const MAIS: Item[] = [
  { label: 'CRM · funil de leads', icon: 'chat', to: '/crm' },
  { label: 'Financeiro', icon: 'pie', to: '/financeiro' },
  { label: 'Ficha de Procedimento', icon: 'clipboard', to: '/ficha-procedimento' },
  { label: 'Relatórios', icon: 'chart', to: '/relatorios' },
  { label: 'Configurações', icon: 'gear', to: '/configuracoes' },
]

export default function TabletShell({ children, onHelp }: { children: ReactNode; onHelp: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [mais, setMais] = useState(false)

  // trocar de rota fecha a folha "Mais"
  useEffect(() => { setMais(false) }, [pathname])

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))
  const emMais = MAIS.some((m) => isActive(m.to))

  const go = (to: string) => {
    if (!confirmLeave()) return
    navigate(to)
  }

  return (
    <div className="app tablet">
      <div className="main">{children}</div>

      <nav className="tabbar" aria-label="Navegação principal">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={`tabbar-item${isActive(t.to) ? ' active' : ''}`}
            onClick={(e) => { if (!confirmLeave()) e.preventDefault() }}
          >
            <Icon name={t.icon} size={23} />
            <span>{t.label}</span>
          </NavLink>
        ))}
        <button className={`tabbar-item${emMais ? ' active' : ''}`} onClick={() => setMais(true)} aria-expanded={mais}>
          <Icon name="dots" size={23} />
          <span>Mais</span>
        </button>
      </nav>

      {mais && (
        <div className="sheet-overlay" onClick={() => setMais(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Mais opções">
            <div className="sheet-grab" />
            <div className="sheet-head">
              <img src="/logo-gl.png" alt="" className="sheet-logo" />
              <div style={{ minWidth: 0 }}>
                <div className="sheet-name">{BRAND.dentist}</div>
                <div className="sheet-role">{BRAND.role}</div>
              </div>
            </div>
            {MAIS.map((m) => (
              <button key={m.to} className={`sheet-item${isActive(m.to) ? ' active' : ''}`} onClick={() => go(m.to)}>
                <Icon name={m.icon} size={20} />
                <span>{m.label}</span>
                <span className="chev-right"><Icon name="chevron" size={17} /></span>
              </button>
            ))}
            <button className="sheet-item" onClick={() => { setMais(false); onHelp() }}>
              <Icon name="help" size={20} />
              <span>Ajuda / tour do sistema</span>
              <Icon name="chevron" size={17} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
