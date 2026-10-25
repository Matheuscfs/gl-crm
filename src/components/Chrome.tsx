import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { guardarLink, sairSePuder } from '../lib/leaveGuard'
import { TemaSeletor } from './TemaSeletor'
import { Icon } from '../icons'
import { useOutsideClick } from './useOutsideClick'
import { useStore, patientPath } from '../store'
import { useToast } from './Toast'
import { BRAND } from '../brand'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useClinic } from '../lib/clinic'
import { parseISO, brDate, isVencidaBr } from '../lib/dates'
import { diasDeRetornoVencido } from '../lib/retornos'

interface Notif { id: string; title: string; body: string }

const READ_KEY = 'gl-notifs-read'
const readSet = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[]) } catch { return new Set() }
}

/** Busca sem acento e sem caixa: "jose" encontra "José". */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Notificações derivadas dos dados reais: estoque, retornos, aniversários e parcelas vencidas. */
function useNotifs(): Notif[] {
  const { estoque, patients } = useStore()
  const [parcelas, setParcelas] = useState<Notif[]>([])

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    supabase.from('installments').select('id,resp,val,venc,status').neq('status', 'pago').then(({ data, error }) => {
      if (cancelled || error || !data) return
      // "vencida" é derivado do vencimento (nada grava esse status no banco)
      setParcelas(data.filter((r) => r.status === 'vencida' || isVencidaBr((r.venc as string) ?? ''))
        .map((r) => ({ id: `parc-${r.id}`, title: 'Parcela vencida', body: `${r.resp ?? '—'} · ${r.val ?? ''} · venc. ${r.venc ?? ''}` })))
    })
    return () => { cancelled = true }
  }, [])

  return useMemo(() => {
    const list: Notif[] = []
    estoque.filter((e) => e.status === 'critico').forEach((e) => list.push({ id: `stk-${e.item}`, title: 'Estoque crítico', body: `${e.item} · ${e.qtd} ${e.un} (mín. ${e.min})` }))
    const baixo = estoque.filter((e) => e.status === 'baixo')
    if (baixo.length) list.push({ id: 'stk-baixo', title: 'Estoque abaixo do mínimo', body: baixo.length === 1 ? baixo[0].item : `${baixo.length} itens para repor` })
    estoque.forEach((e) => {
      if (!e.validade) return
      const dias = Math.floor((parseISO(e.validade).getTime() - Date.now()) / 86400000)
      if (dias < 0) list.push({ id: `val-${e.item}`, title: 'Material vencido', body: `${e.item} · venceu em ${brDate(e.validade)}` })
      else if (dias <= 60) list.push({ id: `val60-${e.item}`, title: 'Validade próxima', body: `${e.item} · vence em ${dias}d (${brDate(e.validade)})` })
    })
    patients.forEach((p) => {
      const dias = diasDeRetornoVencido(p)
      if (dias !== null) list.push({ id: `ret-${p.name}-${p.next}`, title: 'Retorno vencido', body: `${p.name} · ${dias > 0 ? `há ${dias} dias` : p.next}` })
    })
    const today = new Date()
    patients.forEach((p) => {
      if (!p.birthdate) return
      const b = parseISO(p.birthdate)
      if (!Number.isNaN(b.getTime()) && b.getDate() === today.getDate() && b.getMonth() === today.getMonth()) {
        const turns = today.getFullYear() - b.getFullYear()
        list.push({ id: `bday-${p.name}-${today.getFullYear()}`, title: 'Aniversário hoje', body: `${p.name} completa ${turns} ano${turns === 1 ? '' : 's'}` })
      }
    })
    return [...list, ...parcelas]
  }, [estoque, patients, parcelas])
}

/* ---------- Sino de notificações ---------- */
export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const notifs = useNotifs()
  const [read, setRead] = useState<Set<string>>(readSet)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)
  const unread = notifs.filter((n) => !read.has(n.id)).length

  const markAll = () => {
    const next = new Set([...read, ...notifs.map((n) => n.id)])
    setRead(next)
    try { localStorage.setItem(READ_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--surface)', borderColor: 'var(--line)', position: 'relative' }}
        onClick={() => setOpen((v) => !v)} aria-label={unread ? `Notificações: ${unread} não lida${unread === 1 ? '' : 's'}` : 'Notificações'} aria-expanded={open}>
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span aria-hidden="true" style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#d32f2f', color: '#fff', font: "700 10px/16px var(--font)", textAlign: 'center', border: '1.5px solid var(--surface)' }}>{unread}</span>
        )}
      </button>
      {open && (
        <div className="menu-pop" style={{ right: 0, width: 320, maxHeight: 380, overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 8px' }}>
            <span style={{ font: "600 13px var(--font)", color: 'var(--ink)' }}>Notificações</span>
            {unread > 0 && <button className="panel-link" onClick={markAll}>Marcar como lidas</button>}
          </div>
          {notifs.length === 0 && (
            <div style={{ padding: '14px 10px', font: "400 12.5px var(--font)", color: 'var(--muted)' }}>Tudo em dia, nenhuma notificação.</div>
          )}
          {notifs.map((n) => {
            const isUnread = !read.has(n.id)
            return (
              <div key={n.id} style={{ display: 'flex', gap: 10, padding: '9px 8px', borderRadius: 9, background: isUnread ? 'var(--primary-bg)' : 'transparent' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 5, flex: 'none', background: isUnread ? 'var(--primary)' : 'var(--faint)' }} />
                <div>
                  <div style={{ font: "600 12.5px var(--font)", color: 'var(--ink)' }}>{n.title}</div>
                  <div style={{ font: "400 11.5px var(--font)", color: 'var(--muted)' }}>{n.body}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ---------- Busca global (Ctrl+K em qualquer tela) ---------- */
export function GlobalSearch({ width = 300, placeholder = 'Buscar paciente…' }: { width?: number; placeholder?: string }) {
  const navigate = useNavigate()
  const { patients } = useStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = q.trim()
    ? patients.filter((p) => norm(p.name).includes(norm(q)) || norm(p.resp).includes(norm(q))).slice(0, 6)
    : []

  const go = (name: string) => {
    setOpen(false)
    setQ('')
    const p = patients.find((x) => x.name === name)
    navigate(p ? patientPath(p, 'odontograma') : `/pacientes/${encodeURIComponent(name)}/odontograma`)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label className="searchbox" style={{ width, height: 36, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12 }}>
        <Icon name="search" size={16} />
        <input ref={inputRef} value={q} placeholder={placeholder} aria-label={placeholder}
          onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) go(results[0].name) }} />
        <kbd style={{ font: "500 10.5px var(--font)", color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 6, padding: '1px 6px', flex: 'none' }}>Ctrl K</kbd>
      </label>
      {open && q.trim() && (
        <div className="menu-pop" style={{ left: 0, right: 0, width: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '10px 11px', font: "400 12.5px var(--font)", color: 'var(--muted)' }}>Nenhum resultado para "{q}".</div>
          ) : (
            results.map((p) => (
              <button key={p.name} className="menu-item" onClick={() => go(p.name)}>
                <span className="avatar" style={{ width: 26, height: 26, font: "600 10px var(--font)" }}>{p.initials}</span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ font: "500 12.5px var(--font)", color: 'var(--ink)' }}>{p.name}</span>
                  <span style={{ font: "400 11px var(--font)", color: 'var(--muted)' }}>{p.resp}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- Situação da conexão com o banco ---------- */
function SyncStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (!supabase) return <span className="sync demo" title="Sem banco configurado: os dados são fictícios e não ficam salvos"><span className="sync-dot" />Modo demonstração</span>
  if (!online) return <span className="sync off" role="status" title="Sem internet: o que for alterado agora pode não ser salvo"><span className="sync-dot" />Sem conexão</span>
  return <span className="sync" title="Conectado ao banco do consultório"><span className="sync-dot" />Conectado</span>
}

const SECOES: [string, string][] = [
  ['/agenda', 'Agenda'],
  ['/pacientes', 'Pacientes'],
  ['/crm', 'Relacionamento'],
  ['/financeiro', 'Financeiro'],
  ['/estoque', 'Estoque'],
  ['/ficha-procedimento', 'Procedimentos'],
  ['/relatorios', 'Relatórios'],
  ['/configuracoes', 'Configurações'],
]

/* ---------- Barra superior global (desktop) ---------- */
export function AppBar() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const clinic = useClinic()
  const { findPatient, patients } = useStore()

  // cada nível vira link para voltar, menos o último (a tela atual)
  const trilha = useMemo<{ label: string; to?: string }[]>(() => {
    if (pathname === '/') return [{ label: 'Início' }]
    const sec = SECOES.find(([p]) => pathname.startsWith(p))
    const out: { label: string; to?: string }[] = [{ label: sec?.[1] ?? '', to: sec?.[0] }]
    const pac = pathname.match(/^\/pacientes\/([^/]+)/)
    // a rota traz o id do paciente: mostra o nome, não o uuid (findPatient cobre ids provisórios)
    if (pac) {
      const key = decodeURIComponent(pac[1])
      out.push({ label: (patients.find((p) => p._id === key) ?? findPatient(key))?.name ?? 'Paciente' })
    }
    else if (pathname === '/pacientes' && new URLSearchParams(search).get('filtro') === 'vencidos') out.push({ label: 'Retornos vencidos' })
    return out
  }, [pathname, search, findPatient, patients])

  return (
    <div className="appbar">
      <nav className="appbar-crumb" aria-label="Você está em">
        {clinic.name} ·{' '}
        {trilha.map((t, i) => (i === trilha.length - 1
          ? <b key={i} aria-current="page">{t.label}</b>
          : <span key={i}><Link to={t.to ?? '/'} className="crumb-link" onClick={(e) => guardarLink(e, () => navigate(t.to ?? '/'))}>{t.label}</Link> · </span>))}
      </nav>
      <div className="appbar-right">
        <GlobalSearch width={260} />
        <NotificationsBell />
        <SyncStatus />
      </div>
    </div>
  )
}

/* ---------- Menu da conta ----------
   'card': rodapé do menu lateral (avatar, nome e cargo), abre para cima.
   'avatar' + placement 'down': topo das telas do tablet, abre para baixo à direita. */
export function UserMenu({ variant = 'avatar', placement = 'down' }: { variant?: 'avatar' | 'card'; placement?: 'down' }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { email, signOut, disabled: semLogin } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)

  const menuStyle: React.CSSProperties = variant === 'card'
    ? { left: 0, bottom: 'calc(100% + 6px)', top: 'auto', width: 264 }
    : placement === 'down' ? { right: 0, width: 264 } : {}

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {variant === 'card' ? (
        <button className="sb-user" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={`Conta de ${BRAND.dentist}: configurações e sair`}>
          <span className="sb-avatar">{BRAND.initials}</span>
          <span className="sb-user-text">
            <span className="sb-user-name">{BRAND.dentist}</span>
            <span className="sb-user-role">{email || 'Dentista responsável'}</span>
          </span>
          <span className="sb-user-chev"><Icon name="chevUpDown" size={14} /></span>
        </button>
      ) : (
        <button className="sb-avatar" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={`Conta de ${BRAND.dentist}: configurações e sair`}
          style={{ width: 40, height: 40, border: 'none', cursor: 'pointer' }}>{BRAND.initials}</button>
      )}
      {open && (
        <div className="menu-pop" role="menu" style={menuStyle}>
          <div style={{ padding: '6px 10px 8px', borderBottom: '1px solid var(--line-soft)', marginBottom: 4 }}>
            <div style={{ font: "600 12.5px var(--font)", color: 'var(--ink)' }}>{BRAND.dentist}</div>
            <div style={{ font: "400 11px var(--font)", color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email || BRAND.role}</div>
          </div>
          <div className="menu-tema">
            <span>Aparência</span>
            <TemaSeletor />
          </div>
          <button className="menu-item" role="menuitem" onClick={() => { setOpen(false); sairSePuder(() => navigate('/configuracoes')) }}>
            <Icon name="gear" size={15} /> Configurações
          </button>
          {!semLogin && (
            <button className="menu-item danger" role="menuitem" onClick={() => { setOpen(false); sairSePuder(async () => { await signOut(); toast('Sessão encerrada.', 'info') }) }}>
              <Icon name="logout" size={15} /> Sair da conta
            </button>
          )}
        </div>
      )}
    </div>
  )
}
