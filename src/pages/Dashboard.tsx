import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PatientPhoto } from '../components/PatientPhoto'
import { useToast } from '../components/Toast'
import { useStore, initials, patientPath, type PatientRow } from '../store'
import { findPatientForEvent, waLink, contactPhone } from '../lib/whats'
import { todayISO, addDays, parseISO, saudacao, parseBr, brToIso, diffDays } from '../lib/dates'
import { fmtHour, idadeLabel, TREAT_STATUS, type ApptStatus, type Patient } from '../data'
import { diasDeRetornoVencido, rotuloRetornoVencido } from '../lib/retornos'
import { useParcelas } from '../lib/useParcelas'
import { usePedidosRemarcar } from '../lib/automacao'
import { brMoney } from '../lib/money'
import { BRAND } from '../brand'
import { msgRetorno, msgRetoque, msgAniversario, msgConfirmacao, ehCrianca } from '../lib/mensagens'

const WD_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const WD_LOWER = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Situação do atendimento como etiqueta da Fila do dia (texto, não só cor). */
const TAG: Record<ApptStatus, { label: string; cls: string }> = {
  agendado: { label: 'Sem confirmação', cls: 'tag-danger' },
  confirmado: { label: 'Confirmado', cls: 'tag-ok' },
  em_atendimento: { label: 'Em atendimento', cls: 'tag-warn' },
  concluido: { label: 'Concluído', cls: 'tag-neutral' },
  faltou: { label: 'Faltou', cls: 'tag-danger' },
  desmarcado: { label: 'Desmarcado', cls: 'tag-neutral' },
}

type Motivo = 'retorno' | 'parcela' | 'retoque' | 'aniversario'

const MOTIVO: Record<Motivo, { label: string; cls: string }> = {
  retorno: { label: 'Retorno vencido', cls: 'danger' },
  parcela: { label: 'Parcela vencida', cls: 'danger' },
  retoque: { label: 'Retoque', cls: 'warn' },
  aniversario: { label: 'Aniversário', cls: 'info' },
}

/** Retoque estético: a partir de 4 meses desde a última visita. */
const RETOQUE_MESES = 4

interface Contato {
  key: string
  motivo: Motivo
  nome: string
  link?: string
  sub: string
  porque: string
  porqueSub: string
  tratamento: string
  avatar: string
  avatarCls: string
  hot: boolean
  acao: { label: string; danger?: boolean; run: () => void }
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export default function Dashboard() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { events, patients } = useStore()
  const { parcelas, erro: erroParcelas } = useParcelas()
  const [filtro, setFiltro] = useState<Motivo | 'todos'>('todos')

  const today = todayISO()
  const tomorrow = addDays(today, 1)
  const now = parseISO(today)
  const dateLabel = `${WD_FULL[now.getDay()]}, ${now.getDate()} de ${MONTHS_FULL[now.getMonth()]}`
  const mesISO = today.slice(0, 7)
  const doutora = BRAND.dentist.split(' ').slice(0, 2).join(' ')

  const abrirWhats = (p: Patient | undefined, nome: string, msg: string) => {
    const link = waLink(contactPhone(p), msg)
    if (!link) return toast(`Sem telefone cadastrado para ${nome}. Complete o cadastro.`, 'error')
    window.open(link, '_blank', 'noopener')
  }

  /* ---------- hoje e pendências ---------- */
  const hoje = useMemo(
    () => events.filter((e) => e.date === today && e.status !== 'desmarcado').sort((a, b) => a.start - b.start),
    [events, today],
  )
  const amanhaSemConfirmacao = events.filter((e) => e.date === tomorrow && e.status === 'agendado')
  const vencidas = (parcelas ?? []).filter((r) => r.status === 'vencida')
  const diasMaisAntiga = vencidas.reduce((m, r) => Math.max(m, diffDays(brToIso(r.venc) || today, today)), 0)
  // respostas "remarcar" à confirmação automática (WhatsApp): a recepção precisa ligar
  const pedidosRemarcar = usePedidosRemarcar().filter((m) => events.some((e) => e.id === m.appointment_id && e.status === 'agendado'))
  const pendencias = amanhaSemConfirmacao.length + vencidas.length + pedidosRemarcar.length

  const retornos = useMemo(() => patients
    .map((p) => ({ p, dias: diasDeRetornoVencido(p, today) }))
    .filter((x): x is { p: PatientRow; dias: number } => x.dias !== null)
    .sort((a, b) => b.dias - a.dias), [patients, today])

  /* ---------- quem chamar primeiro ---------- */
  const contatos = useMemo<Contato[]>(() => {
    const out: Contato[] = []

    retornos.forEach(({ p, dias }) => {
      out.push({
        key: `ret-${p.name}`, motivo: 'retorno', nome: p.name, link: patientPath(p),
        sub: p.resp && p.resp !== '—' ? p.resp : 'o próprio paciente',
        porque: rotuloRetornoVencido(dias),
        porqueSub: p.last && p.last !== '—' ? `último atendimento em ${p.last}` : 'sem atendimento registrado',
        tratamento: TREAT_STATUS[p.status]?.label ?? '—',
        avatar: p.initials || initials(p.name), avatarCls: 'hot', hot: true,
        acao: {
          label: 'Chamar', danger: true,
          run: () => abrirWhats(p, p.name, msgRetorno(p)),
        },
      })
    })

    vencidas.forEach((r) => {
      const dias = diffDays(brToIso(r.venc) || today, today)
      out.push({
        key: `parc-${r.id}`, motivo: 'parcela', nome: r.resp, sub: 'responsável financeiro',
        porque: `${brMoney(r.val)} desde ${r.venc.slice(0, 5)}`,
        porqueSub: `vencida há ${plural(dias, 'dia', 'dias')}`,
        tratamento: r.ref || '—',
        avatar: initials(r.resp), avatarCls: 'hot', hot: true,
        acao: { label: 'Cobrar', danger: true, run: () => navigate('/financeiro') },
      })
    })

    patients.forEach((p) => {
      if (p.perfil !== 'estetico') return
      const ultima = parseBr(p.last ?? '')
      if (!ultima) return
      const meses = Math.floor(diffDays(ultima, today) / 30)
      if (meses < RETOQUE_MESES) return
      out.push({
        key: `ret-est-${p.name}`, motivo: 'retoque', nome: p.name, link: patientPath(p),
        sub: 'estético',
        porque: `Última visita há ${meses} meses`,
        porqueSub: `em ${p.last}`,
        tratamento: TREAT_STATUS[p.status]?.label ?? '—',
        avatar: p.initials || initials(p.name), avatarCls: 'est', hot: false,
        acao: {
          label: 'Chamar',
          run: () => abrirWhats(p, p.name, msgRetoque(p, meses)),
        },
      })
    })

    patients.forEach((p) => {
      if (!p.birthdate) return
      const b = parseISO(p.birthdate)
      if (Number.isNaN(b.getTime())) return
      for (let i = 0; i < 7; i++) {
        const d = parseISO(addDays(today, i))
        if (d.getDate() !== b.getDate() || d.getMonth() !== b.getMonth()) continue
        const anos = d.getFullYear() - b.getFullYear()
        const quando = i === 0 ? 'hoje' : i === 1 ? 'amanhã' : `${WD_LOWER[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
        out.push({
          key: `bday-${p.name}`, motivo: 'aniversario', nome: p.name, link: patientPath(p),
          sub: p.resp && p.resp !== '—' ? p.resp : 'o próprio paciente',
          porque: `Faz ${plural(anos, 'ano', 'anos')} ${quando}`,
          porqueSub: 'mensagem pronta para enviar',
          tratamento: TREAT_STATUS[p.status]?.label ?? '—',
          avatar: p.initials || initials(p.name), avatarCls: 'info', hot: false,
          acao: {
            label: 'Parabenizar',
            run: () => abrirWhats(p, p.name, msgAniversario(p)),
          },
        })
        break
      }
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retornos, vencidas.length, parcelas, patients, today])

  const contagem = (m: Motivo) => contatos.filter((c) => c.motivo === m).length
  const visiveis = filtro === 'todos' ? contatos : contatos.filter((c) => c.motivo === filtro)

  /* ---------- coluna da direita ---------- */
  const situacao = useMemo(() => {
    const n = (...st: string[]) => patients.filter((p) => st.includes(p.status)).length
    const grupos = [
      { label: 'Em tratamento', n: n('tratamento'), color: 'var(--primary)' },
      { label: 'Manutenção', n: n('manutencao'), color: 'var(--green)' },
      { label: 'Avaliação', n: n('primeira', 'lead'), color: 'var(--amber)' },
      { label: 'Concluído', n: n('concluido'), color: 'var(--faint)' },
    ]
    const total = grupos.reduce((s, g) => s + g.n, 0)
    let acc = 0
    const stops = grupos.map((g) => {
      const de = acc
      acc += total ? (g.n / total) * 100 : 0
      return `${g.color} ${de}% ${acc}%`
    })
    return { grupos, total, gradient: total ? `conic-gradient(${stops.join(', ')})` : 'var(--line-faint)' }
  }, [patients])

  const ultimos14 = useMemo(() => {
    const dias = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
    const porDia = dias.map((iso) => {
      const doDia = events.filter((e) => e.date === iso && e.status !== 'desmarcado')
      return { iso, feitos: doDia.filter((e) => e.status !== 'faltou').length, faltas: doDia.filter((e) => e.status === 'faltou').length }
    })
    const max = Math.max(1, ...porDia.map((d) => d.feitos + d.faltas))
    const total = porDia.reduce((s, d) => s + d.feitos, 0)
    const faltas = porDia.reduce((s, d) => s + d.faltas, 0)
    return { porDia, max, total, faltas, dias }
  }, [events, today])

  const porProcedimento = useMemo(() => {
    const cont = new Map<string, number>()
    events.forEach((e) => {
      if (!e.date?.startsWith(mesISO) || e.status === 'desmarcado' || e.status === 'faltou') return
      const k = (e.proc || 'Consulta').trim()
      cont.set(k, (cont.get(k) ?? 0) + 1)
    })
    const lista = [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    return { lista, max: Math.max(1, ...lista.map(([, n]) => n)) }
  }, [events, mesISO])

  const financeiro = useMemo(() => {
    if (!parcelas) return null
    const doMes = parcelas.filter((r) => brToIso(r.venc).startsWith(mesISO))
    const recebido = doMes.filter((r) => r.status === 'pago').reduce((s, r) => s + r.val, 0)
    const aReceber = doMes.filter((r) => r.status === 'aberto').reduce((s, r) => s + r.val, 0)
    const vencido = parcelas.filter((r) => r.status === 'vencida').reduce((s, r) => s + r.val, 0)
    const total = recebido + aReceber + vencido
    return { recebido, aReceber, vencido, total, vazio: parcelas.length === 0 }
  }, [parcelas, mesISO])

  const pct = (v: number, t: number) => (t ? `${Math.round((v / t) * 100)}%` : '0%')
  const curto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">{saudacao()}, <span className="title-2">{doutora}</span></h1>
          <p className="topbar-sub">{dateLabel}</p>
        </div>
      </header>

      <div className="page-body">
        <div className="home-cols">
          <div className="home-main">
            {/* pendências do dia */}
            <section className="panel hero" aria-live="polite">
              <div>
                {pendencias > 0 ? (
                  <p className="hero-text"><span className="alert">{plural(pendencias, 'pendência', 'pendências')}</span> {pendencias === 1 ? 'aguarda' : 'aguardam'} você hoje.</p>
                ) : (
                  <p className="hero-text"><span className="ok">Tudo em dia</span> por aqui.</p>
                )}
                <p className="hero-sub">
                  {pendencias === 0
                    ? 'Nenhuma consulta de amanhã sem confirmação e nenhuma parcela vencida.'
                    : [
                        amanhaSemConfirmacao.length ? `${plural(amanhaSemConfirmacao.length, 'consulta', 'consultas')} de amanhã ainda sem confirmação` : '',
                        vencidas.length ? `${plural(vencidas.length, 'parcela vencida', 'parcelas vencidas')}${diasMaisAntiga > 30 ? ', a mais antiga há mais de 30 dias' : ''}` : '',
                        pedidosRemarcar.length ? `${plural(pedidosRemarcar.length, 'paciente pediu', 'pacientes pediram')} para remarcar pelo WhatsApp` : '',
                      ].filter(Boolean).join(' · ') + '.'}
                </p>
              </div>
              {pedidosRemarcar.length > 0 ? (
                <button className="btn-cta" onClick={() => navigate('/agenda')}>Ver quem pediu para remarcar</button>
              ) : amanhaSemConfirmacao.length > 0 ? (
                <button className="btn-cta" onClick={() => navigate('/agenda')}>Confirmar consultas de amanhã</button>
              ) : vencidas.length > 0 ? (
                <button className="btn-cta" onClick={() => navigate('/financeiro')}>Ver parcelas vencidas</button>
              ) : null}
            </section>

            {/* fila do dia */}
            <section className="panel" aria-labelledby="fila-titulo">
              <div className="panel-head">
                <h2 id="fila-titulo" className="panel-title">
                  Fila do dia
                  {hoje.length > 0 && <span className="count-pill">{plural(hoje.length, 'atendimento', 'atendimentos')}</span>}
                </h2>
              </div>
              <p className="panel-sub">Horário, situação e o que falta em cada atendimento de hoje.</p>
              {hoje.length === 0 ? (
                <p className="empty-note">Nenhum atendimento marcado para hoje. <Link to="/agenda">Abrir a agenda</Link></p>
              ) : (
                <div className="fila">
                  {hoje.map((e) => {
                    const p = findPatientForEvent(patients, e)
                    const idade = p?.birthdate ? idadeLabel(p.birthdate) : e.age
                    const tag = TAG[e.status]
                    return (
                      <div key={e.id} className="fila-block">
                        <div className="fila-head">
                          <span className="fila-avatar">
                            <PatientPhoto src={p?.photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} fallback={p?.initials ?? initials(e.child)} />
                          </span>
                          {p ? (
                            <Link to={patientPath(p)} className="fila-name">{p.name}{idade ? <span> · {idade}</span> : null}</Link>
                          ) : (
                            <span className="fila-name">{e.child}{idade ? <span> · {idade}</span> : null}</span>
                          )}
                          <span className="fila-time">{fmtHour(e.start)} – {fmtHour(e.start + e.dur)}</span>
                        </div>
                        <div className="fila-row">
                          <span className={`tag ${tag.cls}`}>{tag.label}</span>
                          <span className="fila-desc">{e.proc || 'Consulta'}</span>
                          {e.status === 'agendado' && (
                            <button className="panel-link" onClick={() => abrirWhats(p, e.child, msgConfirmacao(e.child, p, 'hoje', fmtHour(e.start), e.proc, ehCrianca(p)))}>
                              Chamar no WhatsApp
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* retornos vencidos */}
            {retornos.length > 0 && (
              <section className="notice" aria-label="Retornos vencidos">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3.5 22 20H2z" /><path d="M12 10v4" /><path d="M12 17.4v.01" />
                </svg>
                <p className="notice-text">
                  <b>{plural(retornos.length, 'paciente com retorno vencido', 'pacientes com retorno vencido')}</b> · calculado pela data do próximo retorno
                </p>
                <Link to="/pacientes?filtro=vencidos" className="btn-cta sm" style={{ display: 'inline-flex', alignItems: 'center', color: '#fff' }}>Ver pacientes</Link>
              </section>
            )}

            {/* quem chamar primeiro */}
            <section className="panel flush" aria-labelledby="quem-titulo">
              <div className="panel-head">
                <h2 id="quem-titulo" className="panel-title">Quem chamar primeiro</h2>
                <div className="seg-sm" role="group" aria-label="Filtrar por motivo">
                  <button aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos<span className="n">{contatos.length}</span></button>
                  {(Object.keys(MOTIVO) as Motivo[]).map((m) => (
                    <button key={m} aria-pressed={filtro === m} onClick={() => setFiltro(m)}>
                      {MOTIVO[m].label}<span className={`n${MOTIVO[m].cls === 'danger' && contagem(m) ? ' alert' : ''}`}>{contagem(m)}</span>
                    </button>
                  ))}
                </div>
              </div>
              {visiveis.length === 0 ? (
                <p className="qempty">{filtro === 'todos' ? 'Ninguém para chamar agora. Tudo em dia.' : 'Nada neste filtro.'}</p>
              ) : (
                <div className="qtable">
                  <div className="qtable-inner" role="table" aria-label="Pacientes para contatar">
                    <div className="qrow head" role="row">
                      <span role="columnheader">Paciente</span><span role="columnheader">Motivo</span><span role="columnheader">Por quê</span><span role="columnheader">Tratamento</span><span role="columnheader"><span className="visually-hidden">Ação</span></span>
                    </div>
                    {visiveis.map((c) => (
                      <div key={c.key} className={`qrow${c.hot ? ' hot' : ''}`} role="row">
                        <span className="q-person" role="cell">
                          <span className={`q-avatar ${c.avatarCls}`} aria-hidden="true">{c.avatar}</span>
                          <span className="q-text">
                            {c.link ? <Link to={c.link} className="q-main">{c.nome}</Link> : <span className="q-main">{c.nome}</span>}
                            <span className="q-sub">{c.sub}</span>
                          </span>
                        </span>
                        <span role="cell"><span className={`q-reason ${MOTIVO[c.motivo].cls}`}>{MOTIVO[c.motivo].label}</span></span>
                        <span className="q-text" role="cell"><span className="q-main">{c.porque}</span><span className="q-sub">{c.porqueSub}</span></span>
                        <span className="q-text" role="cell"><span className="q-sub" style={{ color: 'var(--slate)' }}>{c.tratamento}</span></span>
                        <span role="cell"><button className={`btn-line${c.acao.danger ? ' danger' : ''}`} style={{ width: '100%' }} onClick={c.acao.run}>{c.acao.label}</button></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          <aside className="home-aside" aria-label="Indicadores">
            <section className="panel" aria-labelledby="sit-titulo">
              <div className="panel-head">
                <h2 id="sit-titulo" className="panel-title sm">Situação dos pacientes</h2>
                <Link to="/pacientes" className="panel-link">Ver mais →</Link>
              </div>
              {situacao.total === 0 ? (
                <p className="empty-note">Nenhum paciente cadastrado ainda.</p>
              ) : (
                <div className="donut-wrap">
                  <div className="donut" style={{ background: situacao.gradient }} role="img"
                    aria-label={`${situacao.total} pacientes: ${situacao.grupos.map((g) => `${g.n} ${g.label.toLowerCase()}`).join(', ')}`}>
                    <div className="donut-hole"><b>{situacao.total}</b><span>pacientes</span></div>
                  </div>
                  <div className="legend">
                    {situacao.grupos.map((g) => (
                      <div key={g.label} className="legend-row">
                        <span className="legend-sw" style={{ background: g.color }} />
                        <span className="l">{g.label}</span>
                        <span className="v">{g.n}</span>
                        <span className="p">{pct(g.n, situacao.total)}</span>
                      </div>
                    ))}
                    {retornos.length > 0 && <div className="legend-row" style={{ color: 'var(--danger)' }}><span className="legend-sw" style={{ background: 'var(--danger)' }} /><span className="l">com retorno vencido</span><span className="v">{retornos.length}</span><span className="p" /></div>}
                  </div>
                </div>
              )}
            </section>

            <section className="panel" aria-labelledby="atend-titulo">
              <div className="panel-head">
                <h2 id="atend-titulo" className="panel-title sm">Atendimentos · 14 dias</h2>
                <Link to="/relatorios" className="panel-link">Ver mais →</Link>
              </div>
              <div className="big-num"><b>{ultimos14.total}</b><span>{plural(ultimos14.total, 'atendimento', 'atendimentos')} · {plural(ultimos14.faltas, 'falta', 'faltas')}</span></div>
              <div className="bars" role="img" aria-label={`Atendimentos por dia nos últimos 14 dias: ${ultimos14.total} atendimentos e ${ultimos14.faltas} faltas`}>
                {ultimos14.porDia.map((d) => (
                  <div key={d.iso} className="bar" title={`${curto(d.iso)}: ${plural(d.feitos, 'atendimento', 'atendimentos')}${d.faltas ? `, ${plural(d.faltas, 'falta', 'faltas')}` : ''}`}>
                    {d.faltas > 0 && <i className="miss" style={{ height: `${(d.faltas / ultimos14.max) * 100}%` }} />}
                    {d.feitos > 0 && <i style={{ height: `${(d.feitos / ultimos14.max) * 100}%` }} />}
                    {d.feitos + d.faltas === 0 && <i className="zero" />}
                  </div>
                ))}
              </div>
              <div className="bars-axis"><span>{curto(ultimos14.dias[0])}</span><span>{curto(ultimos14.dias[7])}</span><span>hoje</span></div>
              <div className="chart-legend">
                <span><span className="legend-sw" style={{ background: 'var(--primary)' }} />Atendimentos</span>
                <span><span className="legend-sw" style={{ background: '#e9705f' }} />Faltas</span>
              </div>
            </section>

            <section className="panel" aria-labelledby="proc-titulo">
              <div className="panel-head">
                <h2 id="proc-titulo" className="panel-title sm">Por procedimento · {MONTHS_FULL[now.getMonth()]}</h2>
              </div>
              {porProcedimento.lista.length === 0 ? (
                <p className="empty-note">Nenhum atendimento neste mês ainda.</p>
              ) : (
                <div className="hbars">
                  {porProcedimento.lista.map(([proc, n]) => (
                    <div key={proc}>
                      <div className="hbar-top"><span>{proc}</span><span>{n}</span></div>
                      <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(n / porProcedimento.max) * 100}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel" aria-labelledby="fin-titulo">
              <div className="panel-head">
                <h2 id="fin-titulo" className="panel-title sm">Financeiro do mês</h2>
                <Link to="/financeiro" className="panel-link">Ver mais →</Link>
              </div>
              {erroParcelas ? (
                <p className="empty-note">Não foi possível carregar o financeiro agora.</p>
              ) : !financeiro ? (
                <p className="empty-note">Carregando…</p>
              ) : financeiro.vazio ? (
                <p className="empty-note">Nenhuma parcela registrada ainda. Elas aparecem quando um plano é aprovado.</p>
              ) : (
                <>
                  <div className="big-num"><b className="md">{brMoney(financeiro.recebido)}</b><span>recebido de {brMoney(financeiro.total)}</span></div>
                  <div className="stack-bar" role="img" aria-label={`Recebido ${brMoney(financeiro.recebido)}, a receber ${brMoney(financeiro.aReceber)}, vencido ${brMoney(financeiro.vencido)}`}>
                    <span style={{ width: pct(financeiro.recebido, financeiro.total), background: 'var(--green)' }} />
                    <span style={{ width: pct(financeiro.aReceber, financeiro.total), background: 'var(--faint)' }} />
                    <span style={{ width: pct(financeiro.vencido, financeiro.total), background: 'var(--danger)' }} />
                  </div>
                  <div className="legend" style={{ marginTop: 12 }}>
                    <div className="legend-row"><span className="legend-sw" style={{ background: 'var(--green)' }} /><span className="l">Recebido (vencimento no mês)</span><span>{brMoney(financeiro.recebido)}</span></div>
                    <div className="legend-row"><span className="legend-sw" style={{ background: 'var(--faint)' }} /><span className="l">A receber no mês</span><span>{brMoney(financeiro.aReceber)}</span></div>
                    <div className="legend-row"><span className="legend-sw" style={{ background: 'var(--danger)' }} /><span className="l">Vencido</span><span style={{ color: 'var(--danger)', fontWeight: 600 }}>{brMoney(financeiro.vencido)}</span></div>
                  </div>
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
    </>
  )
}
