import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../icons'
import { useStore, precisaComprar, patientPath, type EventItem } from '../store'
import { STATUS, fmtHour } from '../data'
import { todayISO, addDays, parseISO, saudacao } from '../lib/dates'
import { brMoney } from '../lib/money'
import { supabase } from '../lib/supabase'
import { useParcelas } from '../lib/useParcelas'
import { UserMenu } from '../components/Chrome'
import { useToast } from '../components/Toast'
import { diasDeRetornoVencido } from '../lib/retornos'
import { msgAniversario, primeiroNome } from '../lib/mensagens'
import { waLink, contactPhone } from '../lib/whats'
import { BRAND } from '../brand'

const WD_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const juntar = (nomes: string[]) => (nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`)

/** Situação escrita na fila: "agendado" de hoje é "Sem confirmação", em vermelho. */
const chipDe = (e: EventItem) => e.status === 'agendado'
  ? { label: 'Sem confirmação', bg: 'var(--red-bg)', fg: 'var(--danger-text)' }
  : { label: STATUS[e.status].label, bg: STATUS[e.status].bg, fg: STATUS[e.status].fg }

/**
 * Resumo — a página inicial no tablet e no celular: o que precisa de você,
 * quatro destaques que levam à tela cheia e a fila do dia.
 */
export default function Resumo() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { events, patients, estoque } = useStore()
  const { parcelas } = useParcelas()

  const today = todayISO()
  const tomorrow = addDays(today, 1)
  const now = new Date()
  const dateLabel = `${WD_FULL[now.getDay()]}, ${now.getDate()} de ${MONTHS_FULL[now.getMonth()]}`
  const doutora = BRAND.dentist.split(' ').slice(0, 2).join(' ')

  const hoje = useMemo(
    () => events.filter((e) => e.date === today && e.status !== 'desmarcado').sort((a, b) => a.start - b.start),
    [events, today],
  )
  const agora = now.getHours() * 60 + now.getMinutes()
  const emSala = hoje.find((e) => e.status === 'em_atendimento')
  const proximo = hoje.find((e) => e.start * 60 >= agora - 30 && e.status !== 'concluido' && e.status !== 'faltou')

  // pendências: as mesmas do Início no computador
  const amanhaSemConfirmacao = events.filter((e) => e.date === tomorrow && e.status === 'agendado')
  const vencidas = (parcelas ?? []).filter((r) => r.status === 'vencida')
  const pendencias = amanhaSemConfirmacao.length + vencidas.length
  const resolver = () => navigate(amanhaSemConfirmacao.length ? '/agenda' : '/financeiro')

  const aReceber = (parcelas ?? []).filter((r) => r.status === 'aberto').reduce((s, r) => s + r.val, 0)
  const totalVencido = vencidas.reduce((s, r) => s + r.val, 0)

  const repor = useMemo(() => estoque.filter(precisaComprar), [estoque])
  const criticos = repor.filter((e) => e.status === 'critico')
  const retornos = useMemo(() => patients
    .map((p) => ({ p, dias: diasDeRetornoVencido(p, today) }))
    .filter((x) => x.dias !== null)
    .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0)), [patients, today])

  const aniversarios = useMemo(() => patients.flatMap((p) => {
    if (!p.birthdate) return []
    const b = parseISO(p.birthdate)
    if (Number.isNaN(b.getTime())) return []
    for (let i = 0; i < 7; i++) {
      const d = parseISO(addDays(today, i))
      if (d.getDate() === b.getDate() && d.getMonth() === b.getMonth()) {
        return [{ p, turns: d.getFullYear() - b.getFullYear(), hoje: i === 0, quando: i === 0 ? 'hoje' : i === 1 ? 'amanhã' : `${d.getDate()}/${d.getMonth() + 1}` }]
      }
    }
    return []
  }), [patients, today])

  const parabenizar = (p: (typeof patients)[number]) => {
    const link = waLink(contactPhone(p), msgAniversario(p))
    if (!link) return toast(`Sem telefone cadastrado para ${p.name}.`, 'error')
    window.open(link, '_blank', 'noopener')
  }

  const abrirPaciente = (nome: string) => {
    const p = patients.find((x) => x.name === nome)
    if (p) navigate(patientPath(p))
    else navigate('/agenda')
  }

  const tiles: { to: string; icon: IconName; label: string; tone: string; toneBg: string; num: string; money?: boolean; sub: string; subDanger?: boolean }[] = [
    {
      to: '/agenda', icon: 'cal', label: 'Agenda de hoje', tone: 'var(--primary)', toneBg: 'var(--primary-bg)',
      num: String(hoje.length),
      sub: hoje.length === 0 ? 'nenhum atendimento marcado'
        : emSala ? `em atendimento: ${primeiroNome(emSala.child)} · ${fmtHour(emSala.start)}`
          : proximo ? `próximo: ${primeiroNome(proximo.child)} · ${fmtHour(proximo.start)}`
            : 'todos atendidos',
    },
    {
      to: '/estoque', icon: 'box', label: 'Estoque a repor', tone: repor.length ? 'var(--amber-dark)' : 'var(--green-dark)', toneBg: repor.length ? 'var(--amber-bg)' : 'var(--green-bg)',
      num: String(repor.length),
      sub: repor.length === 0 ? 'tudo acima do mínimo' : criticos.length ? `${plural(criticos.length, 'item crítico', 'itens críticos')}` : 'abaixo do mínimo · nenhum crítico',
    },
    {
      to: '/financeiro', icon: 'dollar', label: 'A receber', tone: 'var(--green-dark)', toneBg: 'var(--green-bg)',
      num: parcelas ? brMoney(aReceber) : '—', money: true,
      sub: !parcelas ? 'carregando…' : totalVencido > 0 ? `mais ${brMoney(totalVencido)} vencidos` : 'nenhuma parcela vencida',
      subDanger: totalVencido > 0,
    },
    {
      to: '/pacientes?filtro=vencidos', icon: 'clock', label: 'Retornos vencidos', tone: retornos.length ? 'var(--danger-text)' : 'var(--green-dark)', toneBg: retornos.length ? 'var(--red-bg)' : 'var(--green-bg)',
      num: String(retornos.length),
      sub: retornos.length === 0 ? 'todos em dia'
        : retornos.length <= 2 ? `${juntar(retornos.map((r) => primeiroNome(r.p.name)))} · chamar no WhatsApp`
          : 'pacientes para chamar no WhatsApp',
    },
  ]

  return (
    <div className="page-body rs">
      <header className="rs-top">
        <div style={{ minWidth: 0 }}>
          <h1 className="rs-hello">{saudacao(now)}, <span className="title-2">{doutora}</span></h1>
          <p className="rs-date">{dateLabel}</p>
        </div>
        <UserMenu placement="down" />
      </header>

      <section className="panel hero" aria-live="polite">
        <div>
          {pendencias > 0 ? (
            <p className="hero-text"><span className="alert">{plural(pendencias, 'pendência', 'pendências')}</span> {pendencias === 1 ? 'aguarda' : 'aguardam'} você.</p>
          ) : (
            <p className="hero-text"><span className="ok">Tudo em dia</span> por aqui.</p>
          )}
          <p className="hero-sub">
            {pendencias === 0
              ? 'Nenhuma consulta de amanhã sem confirmação e nenhuma parcela vencida.'
              : [
                  amanhaSemConfirmacao.length ? plural(amanhaSemConfirmacao.length, 'consulta de amanhã sem confirmação', 'consultas de amanhã sem confirmação') : '',
                  vencidas.length ? plural(vencidas.length, 'parcela vencida', 'parcelas vencidas') : '',
                ].filter(Boolean).join(' · ')}
          </p>
        </div>
        {pendencias > 0 && <button className="btn-cta" style={{ height: 46, padding: '0 20px', borderRadius: 14 }} onClick={resolver}>Resolver</button>}
      </section>

      <h2 className="rs-h2">Destaques</h2>
      <div className="rs-grid">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="rs-tile" style={{ '--tone': t.tone, '--tone-bg': t.toneBg } as React.CSSProperties}>
            <span className="rs-tile-top"><span className="rs-ico"><Icon name={t.icon} size={18} filled /></span>{t.label}<span className="chev"><Icon name="chevron" size={15} /></span></span>
            <span className={`rs-num${t.money ? ' money' : ''}`}>{t.num}</span>
            <span className={`rs-sub${t.subDanger ? ' danger' : ''}`}>{t.sub}</span>
          </Link>
        ))}
      </div>

      <h2 className="rs-h2">Fila do dia <Link to="/agenda">Ver agenda</Link></h2>
      <div className="rs-list">
        {hoje.length === 0 && <p className="qempty">Nenhum atendimento hoje.</p>}
        {hoje.map((e) => {
          const chip = chipDe(e)
          return (
            <button key={e.id} className={`rs-row${e.status === 'em_atendimento' ? ' now' : ''}`} onClick={() => abrirPaciente(e.child)}>
              <span className="rs-time">{fmtHour(e.start)}</span>
              <span className="rs-main">
                <span className="rs-name">{e.child}</span>
                <span className="rs-desc">{e.proc || 'Atendimento'}</span>
              </span>
              <span className="st-chip" style={{ background: chip.bg, color: chip.fg }}>{chip.label}</span>
            </button>
          )
        })}
      </div>

      {aniversarios.length > 0 && (
        <>
          <h2 className="rs-h2">Aniversários da semana</h2>
          <div className="rs-list">
            {aniversarios.map((b) => (
              <div key={b.p.name} className="rs-row" style={{ cursor: 'default' }}>
                <span className="rs-main">
                  <span className="rs-name">{b.p.name}</span>
                  <span className="rs-desc">{b.quando} · completa {plural(b.turns, 'ano', 'anos')}</span>
                </span>
                <button className="btn-line" style={{ height: 36 }} onClick={() => parabenizar(b.p)}><Icon name="wa" size={15} /> Parabenizar</button>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="rs-sync"><i className={supabase ? '' : 'demo'} />{supabase ? 'Dados salvos no banco do consultório' : 'Modo demonstração, com dados fictícios'}</p>
    </div>
  )
}
