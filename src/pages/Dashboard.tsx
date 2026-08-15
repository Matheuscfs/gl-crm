import { Link } from 'react-router-dom'
import { StatCard, Pill, WaButton } from '../components/ui'
import { NotificationsBell, GlobalSearch } from '../components/Chrome'
import { useToast } from '../components/Toast'
import { useStore, initials } from '../store'
import { findPatientByName } from '../lib/whats'
import Estrategica from './dashboard/Estrategica'
import { todayISO, addDays, parseISO } from '../lib/dates'
import { STATUS, fmtHour } from '../data'

const WD_FULL = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const WD_ABBR = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export default function Dashboard() {
  const { toast } = useToast()
  const { events, patients } = useStore()
  const today = todayISO()
  const tomorrow = addDays(today, 1)
  const now = parseISO(today)
  const dateLabel = `${WD_FULL[now.getDay()]}, ${now.getDate()} de ${MONTHS_FULL[now.getMonth()]} de ${now.getFullYear()}`

  const appts = events.filter((e) => e.date === today).sort((a, b) => a.start - b.start)
    .map((e) => ({ id: e.id, time: fmtHour(e.start), child: e.child, age: e.age, proc: e.proc, resp: '', status: e.status }))
  const overdue = patients.filter((p) => p.late).map((p) => ({ name: p.name, info: p.resp !== '—' ? p.resp : 'Retorno', late: (p.next || '').replace('vencido ', '') || 'vencido' }))
  const retornos = overdue

  // cards computados dos dados reais
  const emAtendimento = events.filter((e) => e.date === today && e.status === 'em_atendimento').length
  const amanha = events.filter((e) => e.date === tomorrow && (e.status === 'agendado' || e.status === 'confirmado')).length
  const faltasMes = events.filter((e) => { const d = parseISO(e.date); return e.status === 'faltou' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() }).length
  const cards = [
    { label: 'Atendimentos hoje', value: String(appts.length), sub: emAtendimento ? `${emAtendimento} em atendimento` : 'nenhum em sala', tone: '#3f6bf5' },
    { label: 'Agendados p/ amanhã', value: String(amanha).padStart(2, '0'), sub: 'confirmar', tone: '#d97706' },
    { label: 'Faltas do mês', value: String(faltasMes).padStart(2, '0'), sub: MONTHS_FULL[now.getMonth()], tone: faltasMes ? '#dc2626' : '#16a34a' },
    { label: 'Retornos vencidos', value: String(overdue.length).padStart(2, '0'), sub: overdue.length ? 'contatar pacientes' : 'em dia', tone: '#3f6bf5' },
  ]

  // aniversariantes da semana (a partir da data de nascimento no cadastro)
  const weekBirthdays = patients.flatMap((p) => {
    if (!p.birthdate) return []
    const b = parseISO(p.birthdate)
    if (Number.isNaN(b.getTime())) return []
    for (let i = 0; i < 7; i++) {
      const d = parseISO(addDays(today, i))
      if (d.getDate() === b.getDate() && d.getMonth() === b.getMonth()) {
        const turns = d.getFullYear() - b.getFullYear()
        return [{ initials: p.initials || initials(p.name), name: p.name, info: `completa ${turns} ano${turns === 1 ? '' : 's'}`, when: i === 0 ? 'hoje' : `${WD_ABBR[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }]
      }
    }
    return []
  })

  // retoques estéticos (pacientes de perfil estético com última visita)
  const retoquesView = patients.filter((p) => p.perfil === 'estetico' && p.last && p.last !== '—')
    .map((p) => ({ name: p.name, info: p.status === 'manutencao' ? 'Manutenção / retoque' : 'Reavaliação estética', since: `última visita ${p.last}` }))

  return (
    <>
      <header className="topbar">
        <div>
          <div className="topbar-title">Bom dia, Dra. Gabriela</div>
          <div className="topbar-sub">{dateLabel}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <GlobalSearch width={300} />
          <NotificationsBell />
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, flex: 'none' }}>
          {cards.map((c) => (
            <StatCard key={c.label} {...c} />
          ))}
        </div>

        <Estrategica />

        <div style={{ flex: 1, minHeight: 340, display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: 20 }}>
          {/* Agenda de hoje */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px 14px',
                borderBottom: '1px solid #f0f2f2',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                <span style={{ font: "800 15px 'Plus Jakarta Sans'", color: '#1a2426' }}>Agenda de hoje</span>
                <span style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8a9699' }}>{appts.length} atendimentos</span>
              </div>
              <Link to="/agenda" style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#3f6bf5' }}>
                Ver agenda completa →
              </Link>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {appts.length === 0 && <div style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#8a9699', padding: '18px 20px' }}>Nenhum atendimento hoje. <Link to="/agenda" style={{ color: '#3f6bf5', fontWeight: 700 }}>Abrir agenda →</Link></div>}
              {appts.map((a) => {
                const st = STATUS[a.status]
                const pat = findPatientByName(patients, a.child)
                return (
                  <div
                    key={a.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: '1px solid #f4f6f6' }}
                  >
                    <div className="tnum" style={{ width: 48, font: "700 13px 'Plus Jakarta Sans'", color: '#1a2426' }}>{a.time}</div>
                    <div style={{ width: 3, height: 38, borderRadius: 2, background: st.dot }} />
                    <div style={{ width: 34, height: 34, borderRadius: '50%', flex: 'none', overflow: 'hidden', background: '#e9eeff', color: '#2f52e0', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "800 12px 'Plus Jakarta Sans'" }}>
                      {pat?.photoUrl ? <img src={pat.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (pat?.initials ?? initials(a.child))}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: "700 13.5px 'Plus Jakarta Sans'", color: '#1a2426' }}>
                        {a.child} <span style={{ color: '#8a9699', fontWeight: 600 }}>· {a.age}</span>
                      </div>
                      <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#5b6a6d' }}>{a.proc}{a.resp ? ` · ${a.resp}` : ''}</div>
                    </div>
                    <Pill bg={st.bg} fg={st.fg} border={st.border}>{st.label}</Pill>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>
            <div className="card" style={{ padding: '16px 18px' }}>
              <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#1a2426', marginBottom: 8 }}>Aniversariantes da semana</div>
              {weekBirthdays.length === 0 && <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8a9699', padding: '6px 0' }}>Nenhum aniversário nos próximos 7 dias.</div>}
              {weekBirthdays.map((b) => (
                <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderBottom: '1px solid #f4f6f6' }}>
                  <div className="avatar" style={{ width: 36, height: 36, background: '#fff4e0', color: '#a35a06' }}>{b.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: "700 13px 'Plus Jakarta Sans'", color: '#1a2426' }}>{b.name}</div>
                    <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#8a9699' }}>{b.info}</div>
                  </div>
                  <div style={{ font: "700 11px 'Plus Jakarta Sans'", color: '#a35a06', background: '#fff4e0', padding: '3px 9px', borderRadius: 20 }}>{b.when}</div>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: '16px 18px', flex: 1, minHeight: 0, overflow: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626' }} />
                <span style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#1a2426' }}>Retornos vencidos</span>
              </div>
              {retornos.length === 0 && <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8a9699', padding: '6px 0' }}>Nenhum retorno vencido. 🎉</div>}
              {retornos.map((o) => (
                <div key={o.name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderBottom: '1px solid #f4f6f6' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "700 13px 'Plus Jakarta Sans'", color: '#1a2426' }}>{o.name}</div>
                    <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#5b6a6d' }}>
                      {o.info} · <span style={{ color: '#a81e1e' }}>vencido {o.late}</span>
                    </div>
                  </div>
                  <WaButton onClick={() => toast(`Mensagem de retorno enviada para ${o.name}.`)}>Contatar</WaButton>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#c2478a' }} />
                <span style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#1a2426' }}>Retoques estéticos</span>
              </div>
              {retoquesView.length === 0 && <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8a9699', padding: '6px 0' }}>Nenhum paciente estético para retoque.</div>}
              {retoquesView.map((r) => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderBottom: '1px solid #f4f6f6' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "700 13px 'Plus Jakarta Sans'", color: '#1a2426' }}>{r.name}</div>
                    <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#5b6a6d' }}>
                      {r.info} · <span style={{ color: '#c2478a' }}>{r.since}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, font: "700 11px 'Plus Jakarta Sans'", color: '#c2478a', background: '#fdeaf3', padding: '5px 10px', borderRadius: 9, cursor: 'pointer' }}
                    onClick={() => toast(`Convite de reavaliação enviado para ${r.name}.`)}>
                    Reavaliar
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
