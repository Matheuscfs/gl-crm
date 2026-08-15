import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../icons'
import { useOutsideClick } from './useOutsideClick'
import { useStore } from '../store'
import { useToast } from './Toast'
import { BRAND } from '../brand'
import { supabase } from '../lib/supabase'
import { parseISO, brDate, isVencidaBr } from '../lib/dates'

interface Notif { id: string; title: string; body: string }

const READ_KEY = 'gl-notifs-read'
const readSet = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[]) } catch { return new Set() }
}

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
    patients.filter((p) => p.late).forEach((p) => list.push({ id: `ret-${p.name}`, title: 'Retorno vencido', body: `${p.name} · ${p.next}` }))
    const today = new Date()
    patients.forEach((p) => {
      if (!p.birthdate) return
      const b = parseISO(p.birthdate)
      if (!Number.isNaN(b.getTime()) && b.getDate() === today.getDate() && b.getMonth() === today.getMonth()) {
        const turns = today.getFullYear() - b.getFullYear()
        list.push({ id: `bday-${p.name}`, title: 'Aniversário hoje', body: `${p.name} completa ${turns} ano${turns === 1 ? '' : 's'}` })
      }
    })
    return [...list, ...parcelas]
  }, [estoque, patients, parcelas])
}

/* ---------- Notifications bell ---------- */
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
      <button className="icon-btn" style={{ width: 40, height: 40, borderRadius: 11, background: '#eef2fb', border: 'none', color: '#5b647a' }} onClick={() => setOpen((v) => !v)} aria-label="Notificações">
        <Icon name="bell" size={20} />
        {unread > 0 && <span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: '50%', background: '#dc2626', border: '1.5px solid #fff' }} />}
      </button>
      {open && (
        <div className="menu-pop" style={{ right: 0, width: 300, maxHeight: 360, overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 8px' }}>
            <span style={{ font: "800 13px 'Plus Jakarta Sans'", color: '#26324a' }}>Notificações</span>
            {unread > 0 && <button className="chip" style={{ background: 'transparent', font: "700 11px 'Plus Jakarta Sans'", color: '#2f52e0', padding: '2px 4px' }} onClick={markAll}>Marcar lidas</button>}
          </div>
          {notifs.length === 0 && (
            <div style={{ padding: '14px 10px', font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Tudo em dia — nenhuma notificação. 🎉</div>
          )}
          {notifs.map((n) => {
            const isUnread = !read.has(n.id)
            return (
              <div key={n.id} style={{ display: 'flex', gap: 10, padding: '9px 8px', borderRadius: 9, background: isUnread ? '#f5f8ff' : 'transparent' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 5, flex: 'none', background: isUnread ? '#3f6bf5' : '#cdd6e6' }} />
                <div>
                  <div style={{ font: "700 12px 'Plus Jakarta Sans'", color: '#26324a' }}>{n.title}</div>
                  <div style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8b93a7' }}>{n.body}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ---------- Global search ---------- */
export function GlobalSearch({ width = 300, placeholder = 'Buscar criança ou responsável…' }: { width?: number; placeholder?: string }) {
  const navigate = useNavigate()
  const { patients } = useStore()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)

  const results = q.trim()
    ? patients.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.resp.toLowerCase().includes(q.toLowerCase())).slice(0, 6)
    : []

  const go = (name: string) => {
    setOpen(false)
    setQ('')
    navigate(`/pacientes/${encodeURIComponent(name)}/odontograma`)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label className="searchbox" style={{ width }}>
        <Icon name="search" size={18} />
        <input value={q} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true) }} />
      </label>
      {open && q.trim() && (
        <div className="menu-pop" style={{ left: 0, right: 0, width: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '10px 11px', font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Nenhum resultado para "{q}".</div>
          ) : (
            results.map((p) => (
              <button key={p.name} className="menu-item" onClick={() => go(p.name)}>
                <span className="avatar" style={{ width: 26, height: 26, font: "800 10px 'Plus Jakarta Sans'" }}>{p.initials}</span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{p.name}</span>
                  <span style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8b93a7' }}>{p.resp}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- Sidebar user menu (opens upward, to the right) ---------- */
export function UserMenu() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick(ref, () => setOpen(false), open)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="sidebar-avatar" onClick={() => setOpen((v) => !v)} title={BRAND.dentist} style={{ cursor: 'pointer', border: '2px solid #fff' }}>{BRAND.initials}</button>
      {open && (
        <div className="menu-pop" style={{ left: 52, bottom: 0, top: 'auto', width: 200 }}>
          <div style={{ padding: '6px 10px 8px', borderBottom: '1px solid #f2f5fb', marginBottom: 4 }}>
            <div style={{ font: "800 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{BRAND.dentist}</div>
            <div style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8b93a7' }}>{BRAND.role}</div>
          </div>
          <button className="menu-item" onClick={() => { setOpen(false); navigate('/configuracoes') }}>Meu perfil</button>
          <button className="menu-item" onClick={() => { setOpen(false); navigate('/configuracoes') }}>Configurações</button>
          <button className="menu-item danger" onClick={() => { setOpen(false); toast('Sessão encerrada.', 'info') }}>Sair</button>
        </div>
      )}
    </div>
  )
}
