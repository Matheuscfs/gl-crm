import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '../icons'
import { guardarLink } from '../lib/leaveGuard'
import { AppBar, UserMenu } from './Chrome'
import { Onboarding, onboardingDone } from './Onboarding'
import TabletShell from './TabletShell'
import { useTablet } from '../lib/useTablet'
import { useStore, precisaComprar } from '../store'
import { retornoVencido } from '../lib/retornos'
import { todayISO, addDays } from '../lib/dates'

type BadgeKey = 'agenda' | 'estoque'

interface SubDef { label: string; to: string; icon: IconName; count?: 'vencidos' }
interface NavDef { label: string; icon: IconName; to: string; badge?: BadgeKey; subs?: SubDef[] }

const NAV: NavDef[] = [
  { label: 'Início', icon: 'home', to: '/' },
  { label: 'Agenda', icon: 'cal', to: '/agenda', badge: 'agenda' },
  {
    label: 'Pacientes', icon: 'users', to: '/pacientes',
    subs: [
      { label: 'Lista', to: '/pacientes', icon: 'list' },
      { label: 'Retornos vencidos', to: '/pacientes?filtro=vencidos', icon: 'clock', count: 'vencidos' },
    ],
  },
  { label: 'Relacionamento', icon: 'chat', to: '/crm' },
  { label: 'Financeiro', icon: 'wallet', to: '/financeiro' },
  { label: 'Estoque', icon: 'box', to: '/estoque', badge: 'estoque' },
  { label: 'Procedimentos', icon: 'clipboard', to: '/ficha-procedimento' },
  { label: 'Relatórios', icon: 'chart', to: '/relatorios' },
]

const BADGE_DESC: Record<BadgeKey, [string, string]> = {
  agenda: ['consulta sem confirmação', 'consultas sem confirmação'],
  estoque: ['item para comprar', 'itens para comprar'],
}

const STORAGE_KEY = 'gl-sidebar-compact'

function readCompact() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function Sidebar({ compact, animating, onToggle, onHelp }: { compact: boolean; animating: boolean; onToggle: () => void; onHelp: () => void }) {
  const { pathname, search } = useLocation()
  const { events, estoque, patients } = useStore()
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))

  const today = todayISO()
  const tomorrow = addDays(today, 1)
  const badges: Record<BadgeKey, number> = {
    // hoje e amanhã ainda sem confirmação do paciente
    agenda: events.filter((e) => (e.date === today || e.date === tomorrow) && e.status === 'agendado').length,
    estoque: estoque.filter(precisaComprar).length,
  }
  const vencidos = patients.filter((p) => retornoVencido(p, today)).length
  const filtroVencidos = new URLSearchParams(search).get('filtro') === 'vencidos'

  const navigate = useNavigate()
  const asideRef = useRef<HTMLElement>(null)
  // pílula que desliza até o item ativo (em vez de o destaque "pular" de um item para o outro)
  const [glide, setGlide] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [glideReady, setGlideReady] = useState(false)
  useLayoutEffect(() => {
    const aside = asideRef.current
    if (!aside) return
    const medir = () => {
      const el = aside.querySelector<HTMLElement>('.nav-item.active')
      setGlide(el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null)
    }
    medir()
    // subitens abrindo, menu recolhendo, fonte carregando: a posição muda sem trocar de rota
    const ro = new ResizeObserver(medir)
    ro.observe(aside)
    aside.querySelectorAll('.sb-nav').forEach((n) => ro.observe(n))
    const t = window.setTimeout(() => setGlideReady(true), 60)
    return () => { ro.disconnect(); window.clearTimeout(t) }
  }, [pathname, search, compact])
  // com dados não salvos, o link pergunta antes (na confirmação do app) e só então navega
  const guard = (to: string) => (e: React.MouseEvent) => guardarLink(e, () => navigate(to))

  const renderItem = (n: NavDef) => {
    const active = isActive(n.to)
    const count = n.badge ? badges[n.badge] : 0
    const open = active && !!n.subs && !compact
    const desc = n.badge ? BADGE_DESC[n.badge][count === 1 ? 0 : 1] : ''
    return (
      <div key={n.to}>
        <Link
          to={n.to}
          className={`nav-item${active ? ' active' : ''}`}
          aria-current={active ? 'page' : undefined}
          aria-label={count ? `${n.label}: ${count} ${desc}` : compact ? n.label : undefined}
          data-tip={compact ? n.label : undefined}
          onClick={guard(n.to)}
        >
          <span className="nav-ico"><Icon name={n.icon} size={18} /></span>
          <span className="nav-label">{n.label}</span>
          {count > 0 && <span className={`nav-badge${n.badge === 'estoque' ? ' warn' : ''}`} aria-hidden="true">{count}</span>}
          {n.subs && <span className={`nav-chev${open ? ' open' : ''}`} aria-hidden="true"><Icon name="chevDown" size={14} /></span>}
        </Link>
        {open && n.subs!.map((s) => {
          const subActive = s.count === 'vencidos' ? filtroVencidos : pathname === n.to && !filtroVencidos
          return (
            <Link key={s.to} to={s.to} className={`nav-sub${subActive ? ' active' : ''}`} aria-current={subActive ? 'page' : undefined} onClick={guard(s.to)}>
              <Icon name={s.icon} size={14} />
              {s.label}
              {s.count === 'vencidos' && vencidos > 0 && <span className="count">{vencidos}</span>}
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`sb-wrap${compact ? ' compact' : ''}`}>
    <aside ref={asideRef} className={`sidebar has-glide${compact ? ' compact' : ''}${animating ? ' animating' : ''}`}>
      <span
        className={`nav-glide${glideReady && !animating ? '' : ' instant'}`}
        aria-hidden="true"
        style={glide ? { transform: `translate(${glide.x}px, ${glide.y}px)`, width: glide.w, height: glide.h } : { opacity: 0 }}
      />
      <div className="sb-brand">
        <div className="sb-logo" aria-hidden="true"><span className="gl-neon">GL</span></div>
        <div className="sb-brand-text">
          <div className="sb-brand-name">GL CRM</div>
          <div className="sb-brand-sub">Gabriela Lorenzi</div>
        </div>
      </div>

      <nav className="sb-nav" aria-label="Menu principal">{NAV.map(renderItem)}</nav>
      <div className="sb-spacer" />
      <nav className="sb-nav" aria-label="Ajuda e configurações">
        <button className="nav-item" data-tip={compact ? 'Ajuda e tour' : undefined} aria-label={compact ? 'Ajuda e tour' : undefined} onClick={onHelp}>
          <span className="nav-ico"><Icon name="help" size={18} /></span>
          <span className="nav-label">Ajuda e tour</span>
        </button>
        {renderItem({ label: 'Configurações', icon: 'gear', to: '/configuracoes' })}
      </nav>
      <UserMenu variant="card" />
    </aside>
    {/* borda direita do cartão: ao passar o mouse aparece a alça para recolher/expandir (Ctrl+B) */}
    <button className="sb-edge" onClick={onToggle} aria-label={compact ? 'Expandir menu' : 'Recolher menu'} aria-expanded={!compact}>
      <span className="sb-edge-line" aria-hidden="true" />
      <span className="sb-edge-knob" aria-hidden="true"><Icon name="chevron" size={14} /></span>
      <span className="sb-edge-tip" aria-hidden="true">{compact ? 'Expandir menu' : 'Recolher menu'} <kbd>Ctrl B</kbd></span>
    </button>
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const [compact, setCompact] = useState(readCompact)
  // durante a transição o cartão corta o conteúdo; recolhido e parado, as dicas podem sair para fora
  const [animating, setAnimating] = useState(false)
  // abre sozinho no primeiro acesso; o botão Ajuda reabre quando quiser
  const [onboarding, setOnboarding] = useState(() => !onboardingDone())
  const tablet = useTablet()

  const toggle = () => {
    setAnimating(true)
    window.setTimeout(() => setAnimating(false), 320)
    setCompact((v) => {
      const next = !v
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  // Ctrl+B (Cmd+B no Mac) recolhe/expande o menu, como no VS Code e no Notion
  useEffect(() => {
    if (tablet) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        const t = e.target as HTMLElement | null
        if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablet])

  // tablet/celular: shell estilo Apple Health (tab bar embaixo) no lugar do menu lateral
  if (tablet) {
    return (
      <>
        <TabletShell onHelp={() => setOnboarding(true)}><AvisoCarga />{children}</TabletShell>
        <Onboarding open={onboarding} onClose={() => setOnboarding(false)} />
      </>
    )
  }

  return (
    <div className="app">
      <Sidebar compact={compact} animating={animating} onToggle={toggle} onHelp={() => setOnboarding(true)} />
      <div className="main">
        <AppBar />
        <AvisoCarga />
        {children}
      </div>
      <Onboarding open={onboarding} onClose={() => setOnboarding(false)} />
    </div>
  )
}

/** Se a carga do banco falhar, avisa no topo (com "Tentar de novo") em vez de mostrar telas vazias. */
function AvisoCarga() {
  const { carga, erroCarga, recarregar } = useStore()
  if (carga !== 'erro') return null
  return (
    <div className="notice carga-aviso" role="alert">
      <Icon name="alert" size={18} />
      <p className="notice-text"><b>Parte dos dados não carregou do banco.</b> O que aparece pode estar incompleto{erroCarga ? ` (${erroCarga})` : ''}.</p>
      <button className="btn-cta sm" onClick={recarregar}>Tentar de novo</button>
    </div>
  )
}
