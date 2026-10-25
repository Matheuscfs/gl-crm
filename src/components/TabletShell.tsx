import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../icons'
import { guardarLink, sairSePuder } from '../lib/leaveGuard'
import { BRAND } from '../brand'
import { useAuth } from '../lib/auth'
import { useToast } from './Toast'
import { useEscLayer } from './layers'
import { supabase } from '../lib/supabase'
import { TemaSeletor } from './TemaSeletor'

interface Item { label: string; icon: IconName; to: string; tile?: string }

/** Abas fixas da barra inferior — o resto entra em "Mais". */
const TABS: Item[] = [
  { label: 'Resumo', icon: 'home', to: '/' },
  { label: 'Agenda', icon: 'cal', to: '/agenda' },
  { label: 'Pacientes', icon: 'users', to: '/pacientes' },
  { label: 'Estoque', icon: 'box', to: '/estoque' },
]

const MAIS: Item[] = [
  { label: 'Relacionamento', icon: 'chat', to: '/crm', tile: '#34c759' },
  { label: 'Financeiro', icon: 'wallet', to: '/financeiro', tile: '#ff9500' },
  { label: 'Procedimentos', icon: 'clipboard', to: '/ficha-procedimento', tile: '#af52de' },
  { label: 'Relatórios', icon: 'chart', to: '/relatorios', tile: '#5856d6' },
  { label: 'Configurações', icon: 'gear', to: '/configuracoes', tile: '#8e8e93' },
]

export default function TabletShell({ children, onHelp }: { children: ReactNode; onHelp: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [mais, setMais] = useState(false)
  const { signOut, disabled: semLogin, email } = useAuth()
  const { toast } = useToast()
  useEscLayer(mais, () => setMais(false))

  // trocar de rota fecha a folha "Mais"
  useEffect(() => { setMais(false) }, [pathname])

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))
  const emMais = MAIS.some((m) => isActive(m.to))

  const go = (to: string) => sairSePuder(() => {
    setMais(false) // tocar na página atual também fecha (o efeito do pathname não dispara)
    navigate(to)
  })

  const sair = () => sairSePuder(async () => {
    setMais(false)
    await signOut()
    toast('Sessão encerrada.', 'info')
  })

  return (
    <div className="app tablet">
      <main className="main">{children}</main>

      <nav className="tabbar" aria-label="Navegação principal">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={`tabbar-item${isActive(t.to) ? ' active' : ''}`}
            onClick={(e) => guardarLink(e, () => navigate(t.to))}
          >
            <Icon name={t.icon} size={25} filled={isActive(t.to)} />
            <span>{t.label}</span>
          </NavLink>
        ))}
        <button className={`tabbar-item${emMais ? ' active' : ''}`} onClick={() => setMais(true)} aria-expanded={mais}>
          <Icon name="more" size={25} filled={emMais || mais} />
          <span>Mais</span>
        </button>
      </nav>

      {mais && (
        <div className="sheet-overlay" onClick={() => setMais(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Mais opções">
            <div className="sheet-grab" />
            <div className="sheet-head">
              <span className="sheet-avatar" aria-hidden="true">GL</span>
              <div style={{ minWidth: 0 }}>
                <div className="sheet-name">{BRAND.dentist}</div>
                <div className="sheet-role">{email || BRAND.role}</div>
              </div>
              <button className="sheet-close" aria-label="Fechar" onClick={() => setMais(false)}><Icon name="close" size={18} /></button>
            </div>
            <div className="sheet-list">
              {MAIS.map((m) => (
                <button key={m.to} className={`sheet-item${isActive(m.to) ? ' active' : ''}`} aria-current={isActive(m.to) ? 'page' : undefined} onClick={() => go(m.to)}>
                  <span className="sheet-ico" style={{ '--tile': m.tile } as React.CSSProperties}><Icon name={m.icon} size={17} /></span>
                  <span>{m.label}</span>
                  <span className="chev-right"><Icon name="chevron" size={16} /></span>
                </button>
              ))}
              <button className="sheet-item" onClick={() => { setMais(false); onHelp() }}>
                <span className="sheet-ico" style={{ '--tile': '#ff2d55' } as React.CSSProperties}><Icon name="help" size={17} /></span>
                <span>Ajuda e tour do sistema</span>
                <span className="chev-right"><Icon name="chevron" size={16} /></span>
              </button>
            </div>
            <div className="sheet-tema">
              <span>Aparência</span>
              <TemaSeletor size="md" />
            </div>
            {!semLogin && (
              <button className="sheet-item danger" onClick={sair}>
                <span className="sheet-ico"><Icon name="logout" size={17} /></span>
                <span>Sair da conta</span>
              </button>
            )}
            <p className="sheet-foot">GL CRM · {supabase ? 'dados salvos no banco do consultório' : 'modo demonstração'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
