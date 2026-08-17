import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../icons'
import { useStore, initials, precisaComprar } from '../store'
import { STATUS, fmtHour } from '../data'
import { areaInfo, AREA_PADRAO } from '../inventario'
import { todayISO, addDays, parseISO } from '../lib/dates'
import { brMoney, parseMoney } from '../lib/money'
import { supabase } from '../lib/supabase'
import { isVencidaBr } from '../lib/dates'
import { UserMenu } from '../components/Chrome'

const WD_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Saudação pelo horário — o Resumo abre o dia. */
function saudacao(h: number) {
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/**
 * Resumo — a home do modo tablet, no espírito do app Saúde da Apple:
 * "Destaques" em cartões grandes e coloridos, cada um levando à tela cheia.
 */
export default function Resumo() {
  const { events, patients, estoque } = useStore()
  const [aReceber, setAReceber] = useState<{ total: number; vencidas: number } | null>(null)

  const today = todayISO()
  const now = new Date()
  const dateLabel = `${WD_FULL[now.getDay()]}, ${now.getDate()} de ${MONTHS_FULL[now.getMonth()]}`

  // contas a receber: só do banco (sem seed) para o cartão não mentir
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    supabase.from('installments').select('val,venc,status').then(({ data, error }) => {
      if (cancelled || error || !data) return
      const abertas = data.filter((r) => (r.status as string) !== 'pago')
      setAReceber({
        total: abertas.reduce((s, r) => s + parseMoney((r.val as string) ?? ''), 0),
        vencidas: abertas.filter((r) => isVencidaBr((r.venc as string) ?? '')).length,
      })
    })
    return () => { cancelled = true }
  }, [])

  const hoje = useMemo(
    () => events.filter((e) => e.date === today).sort((a, b) => a.start - b.start),
    [events, today],
  )
  const agora = now.getHours() * 60 + now.getMinutes()
  const proximo = hoje.find((e) => e.start * 60 >= agora - 30 && e.status !== 'concluido' && e.status !== 'faltou') ?? hoje[0]
  const concluidos = hoje.filter((e) => e.status === 'concluido').length

  const repor = useMemo(() => estoque.filter(precisaComprar), [estoque])
  const criticos = repor.filter((e) => e.status === 'critico')
  const atrasados = useMemo(() => patients.filter((p) => p.late), [patients])

  const aniversarios = useMemo(() => patients.flatMap((p) => {
    if (!p.birthdate) return []
    const b = parseISO(p.birthdate)
    if (Number.isNaN(b.getTime())) return []
    for (let i = 0; i < 7; i++) {
      const d = parseISO(addDays(today, i))
      if (d.getDate() === b.getDate() && d.getMonth() === b.getMonth()) {
        return [{ name: p.name, initials: p.initials || initials(p.name), turns: d.getFullYear() - b.getFullYear(), hoje: i === 0 }]
      }
    }
    return []
  }), [patients, today])

  return (
    <>
      <header className="hl-topbar">
        <div style={{ minWidth: 0 }}>
          <div className="hl-title">Resumo</div>
          <div className="hl-sub">{dateLabel}</div>
        </div>
        <UserMenu />
      </header>

      <div className="hl-scroll">
        <div className="hl-hello">{saudacao(now.getHours())}, Dra. Gabriela 👋</div>

        <div className="hl-section">Destaques</div>
        <div className="hl-grid hl-grid-2">
          <Link to="/agenda" className="hl-card hl-tile" style={{ '--area': '#3f6bf5', '--area-bg': '#e9eeff' } as React.CSSProperties}>
            <span className="hl-tile-top"><span className="hl-tile-emoji" aria-hidden>🦷</span> Agenda de hoje</span>
            <span className="hl-tile-num tnum">{hoje.length}</span>
            <span className="hl-tile-sub">
              {hoje.length === 0
                ? 'nenhum atendimento marcado'
                : proximo
                  ? `próximo ${fmtHour(proximo.start)} · ${proximo.child}`
                  : `${concluidos} concluídos`}
            </span>
          </Link>

          <Link to="/estoque" className="hl-card hl-tile" style={{ '--area': repor.length ? '#d97706' : '#2f9a5b', '--area-bg': repor.length ? '#fdf1e2' : '#e7f6ee' } as React.CSSProperties}>
            <span className="hl-tile-top"><span className="hl-tile-emoji" aria-hidden>📦</span> Estoque a repor</span>
            <span className="hl-tile-num tnum">{repor.length}</span>
            <span className="hl-tile-sub">
              {repor.length === 0 ? 'tudo acima do mínimo' : criticos.length ? `${criticos.length} em nível crítico` : 'abaixo do mínimo'}
            </span>
          </Link>

          <Link to="/financeiro" className="hl-card hl-tile" style={{ '--area': '#2f9a5b', '--area-bg': '#e7f6ee' } as React.CSSProperties}>
            <span className="hl-tile-top"><span className="hl-tile-emoji" aria-hidden>💰</span> A receber</span>
            <span className="hl-tile-num tnum" style={{ fontSize: 26 }}>{aReceber ? brMoney(aReceber.total) : '—'}</span>
            <span className="hl-tile-sub">
              {!aReceber ? 'conectando ao banco…' : aReceber.vencidas ? `${aReceber.vencidas} parcela(s) vencida(s)` : 'nenhuma parcela vencida'}
            </span>
          </Link>

          <Link to="/pacientes" className="hl-card hl-tile" style={{ '--area': '#c2478a', '--area-bg': '#fdeaf3' } as React.CSSProperties}>
            <span className="hl-tile-top"><span className="hl-tile-emoji" aria-hidden>👥</span> Retornos vencidos</span>
            <span className="hl-tile-num tnum">{atrasados.length}</span>
            <span className="hl-tile-sub">{atrasados.length ? 'pacientes para contatar' : 'todos em dia'}</span>
          </Link>
        </div>

        <div className="hl-section">
          Agenda de hoje
          <Link className="hl-section-link" to="/agenda">ver tudo</Link>
        </div>
        <div className="hl-list">
          {hoje.length === 0 && <div className="hl-empty">Nenhum atendimento hoje.</div>}
          {hoje.slice(0, 6).map((e) => {
            const st = STATUS[e.status]
            const pat = patients.find((p) => p.name === e.child)
            return (
              <div key={e.id} className="hl-row">
                <span className="hl-row-time tnum">{fmtHour(e.start)}</span>
                <span className="hl-row-avatar">
                  {pat?.photoUrl ? <img src={pat.photoUrl} alt="" /> : (pat?.initials ?? initials(e.child))}
                </span>
                <span className="hl-row-main" style={{ display: 'block' }}>
                  <span className="hl-row-name">{e.child}</span>
                  <span className="hl-row-sub">{e.proc || 'Atendimento'}</span>
                </span>
                <span className="pill" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
              </div>
            )
          })}
        </div>

        {repor.length > 0 && (
          <>
            <div className="hl-section">
              Repor no estoque
              <Link className="hl-section-link" to="/estoque">ver tudo</Link>
            </div>
            <div className="hl-list">
              {repor.slice(0, 5).map((e) => {
                const info = areaInfo(e.cat) ?? { ...AREA_PADRAO, key: e.cat, label: e.cat }
                return (
                  <div key={e.item} className="hl-row">
                    <span className="hl-row-emoji" style={{ background: info.bg }} aria-hidden>{info.emoji}</span>
                    <span className="hl-row-main" style={{ display: 'block' }}>
                      <span className="hl-row-name">{e.item}</span>
                      <span className="hl-row-sub">{e.cat} · tem {e.qtd} {e.un}, mínimo {e.min}</span>
                    </span>
                    <span className="pill" style={{ background: '#fdf1e2', color: '#9a5a06' }}>comprar</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {aniversarios.length > 0 && (
          <>
            <div className="hl-section">Aniversariantes da semana</div>
            <div className="hl-list">
              {aniversarios.map((b) => (
                <div key={b.name} className="hl-row">
                  <span className="hl-row-avatar" style={{ background: '#fff4e0', color: '#a35a06' }}>{b.initials}</span>
                  <span className="hl-row-main" style={{ display: 'block' }}>
                    <span className="hl-row-name">{b.name}</span>
                    <span className="hl-row-sub">completa {b.turns} ano{b.turns === 1 ? '' : 's'}</span>
                  </span>
                  {b.hoje && <span className="pill" style={{ background: '#fff4e0', color: '#a35a06' }}>hoje 🎂</span>}
                </div>
              ))}
            </div>
          </>
        )}

        {atrasados.length > 0 && (
          <>
            <div className="hl-section">Precisa de atenção</div>
            <div className="hl-list">
              {atrasados.slice(0, 5).map((p) => (
                <Link key={p.name} to="/pacientes" className="hl-row">
                  <span className="hl-row-emoji" style={{ background: '#fbeaea' }} aria-hidden>⏰</span>
                  <span className="hl-row-main" style={{ display: 'block' }}>
                    <span className="hl-row-name">{p.name}</span>
                    <span className="hl-row-sub">retorno {p.next || 'vencido'}</span>
                  </span>
                  <span className="chev-right" style={{ color: '#c1c8d6' }}><Icon name="chevron" size={18} /></span>
                </Link>
              ))}
            </div>
          </>
        )}

        <div className="hl-foot">GL CRM · dados sincronizados com o Supabase</div>
      </div>
    </>
  )
}
