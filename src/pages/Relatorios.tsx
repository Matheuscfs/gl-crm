import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dropdown } from '../components/Menu'
import { CountUp } from '../components/ui'
import { EmptyState } from '../components/States'
import { useStore, matchFicha } from '../store'
import { supabase } from '../lib/supabase'
import { parseISO, todayISO } from '../lib/dates'
import { dayRange } from '../lib/horarios'
import { brMoney, parseMoney } from '../lib/money'
import { STATUS, type ApptStatus, type ApptKind } from '../data'

const PERIODOS = ['Este mês', 'Últimos 30 dias', 'Últimos 90 dias', 'Tudo']
const DAY_MS = 86400000

/** "dd/mm/aaaa" → ISO, ou '' se inválido. */
const brToIso = (s: string) => {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || '')
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

const PERFIL_KIND: Record<string, { label: string; color: string }> = {
  ped: { label: 'Pediátrico', color: '#3f6bf5' },
  est: { label: 'Estético', color: '#c2478a' },
  adt: { label: 'Adulto', color: '#0f766e' },
}

export default function Relatorios() {
  const { events, horarios, funil, procedimentos, patients } = useStore()
  const [periodo, setPeriodo] = useState(PERIODOS[0])
  const [parcelasPagas, setParcelasPagas] = useState<{ venc: string; val: number }[]>([])
  const [receitasPagas, setReceitasPagas] = useState<{ date: string; value: number }[]>([])

  // financeiro (parcelas e receitas pagas) — carregado do banco
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    supabase.from('installments').select('venc,val').eq('status', 'pago').then(({ data, error }) => {
      if (cancelled || error || !data) return
      setParcelasPagas(data.map((r) => ({ venc: (r.venc as string) ?? '', val: parseMoney((r.val as string) ?? '') })))
    })
    supabase.from('finance_entries').select('entry_date,value,type,status').eq('type', 'receita').eq('status', 'pago').then(({ data, error }) => {
      if (cancelled || error || !data) return
      setReceitasPagas(data.map((r) => ({ date: (r.entry_date as string) ?? '', value: Number(r.value) || 0 })))
    })
    return () => { cancelled = true }
  }, [])

  // janela do período [from, to] em ISO (to = hoje)
  const window_ = useMemo(() => {
    const to = todayISO()
    const now = parseISO(to)
    if (periodo === 'Este mês') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`, to }
    }
    if (periodo === 'Últimos 30 dias' || periodo === 'Últimos 90 dias') {
      const days = periodo === 'Últimos 30 dias' ? 30 : 90
      const d = new Date(now.getTime() - (days - 1) * DAY_MS)
      return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, to }
    }
    const dates = events.map((e) => e.date).filter(Boolean).sort()
    return { from: dates[0] ?? to, to }
  }, [periodo, events])

  const inPeriod = useCallback((iso: string) => !!iso && iso >= window_.from && iso <= window_.to, [window_])

  const evPeriodo = useMemo(() => events.filter((e) => inPeriod(e.date)), [events, inPeriod])

  const stats = useMemo(() => {
    const ativos = evPeriodo.filter((e) => e.status !== 'desmarcado')
    const concluidos = ativos.filter((e) => e.status === 'concluido').length
    const faltas = ativos.filter((e) => e.status === 'faltou').length
    const taxaFaltas = ativos.length ? Math.round((faltas / ativos.length) * 100) : 0

    // ocupação: horas agendadas ÷ horas de expediente no período
    let expediente = 0
    for (let t = parseISO(window_.from).getTime(); t <= parseISO(window_.to).getTime(); t += DAY_MS) {
      const d = new Date(t)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const r = dayRange(horarios, iso)
      if (r) expediente += r.end - r.start
    }
    const agendadas = ativos.filter((e) => e.status !== 'faltou').reduce((s, e) => s + e.dur, 0)
    const ocupacao = expediente ? Math.min(100, Math.round((agendadas / expediente) * 100)) : 0

    const faturado = parcelasPagas.filter((p) => inPeriod(brToIso(p.venc))).reduce((s, p) => s + p.val, 0)
      + receitasPagas.filter((r) => inPeriod(brToIso(r.date))).reduce((s, r) => s + r.value, 0)

    return { concluidos, faltas, taxaFaltas, ocupacao, faturado, total: ativos.length }
  }, [evPeriodo, horarios, window_, parcelasPagas, receitasPagas, inPeriod])

  // procedimentos mais realizados (exclui desmarcados e faltas)
  const topProcs = useMemo(() => {
    const count = new Map<string, number>()
    evPeriodo.filter((e) => e.status !== 'desmarcado' && e.status !== 'faltou')
      .forEach((e) => count.set(e.proc, (count.get(e.proc) ?? 0) + 1))
    const sorted = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    const max = Math.max(1, ...sorted.map(([, n]) => n))
    return { sorted, max }
  }, [evPeriodo])

  const porStatus = useMemo(() => {
    const order: ApptStatus[] = ['concluido', 'confirmado', 'agendado', 'em_atendimento', 'faltou', 'desmarcado']
    const max = Math.max(1, ...order.map((s) => evPeriodo.filter((e) => e.status === s).length))
    return { order, max }
  }, [evPeriodo])

  const porPerfil = useMemo(() => {
    const kinds: ApptKind[] = ['ped', 'est', 'adt']
    const counts = kinds.map((k) => ({ k, n: evPeriodo.filter((e) => (e.kind ?? 'ped') === k && e.status !== 'desmarcado').length }))
    const tot = Math.max(1, counts.reduce((s, c) => s + c.n, 0))
    return { counts, tot }
  }, [evPeriodo])

  // faturamento por procedimento (concluídos × tabela de preços)
  const procFat = useMemo(() => {
    const val = new Map<string, number>()
    evPeriodo.filter((e) => e.status === 'concluido').forEach((e) => {
      const v = matchFicha(procedimentos, e.proc)?.val ?? 0
      if (v > 0) val.set(e.proc, (val.get(e.proc) ?? 0) + v)
    })
    const sorted = [...val.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    const max = Math.max(1, ...sorted.map(([, v]) => v))
    const total = [...val.values()].reduce((s, v) => s + v, 0)
    return { sorted, max, total }
  }, [evPeriodo, procedimentos])

  // faltas por dia da semana
  const faltasDia = useMemo(() => {
    const counts = Array(7).fill(0) as number[]
    evPeriodo.filter((e) => e.status === 'faltou').forEach((e) => { counts[parseISO(e.date).getDay()]++ })
    const max = Math.max(1, ...counts)
    const total = counts.reduce((s, n) => s + n, 0)
    return { counts, max, total }
  }, [evPeriodo])

  // origem de leads e pacientes (campo dedicado; leads antigos: primeiro trecho do info, ex. "Instagram · hoje")
  const origens = useMemo(() => {
    const count = new Map<string, number>()
    funil.flatMap((c) => c.cards).forEach((c) => {
      const o = (c.origem || '').trim() || (c.info || '').split('·')[0].trim()
      if (o) count.set(o, (count.get(o) ?? 0) + 1)
    })
    patients.forEach((p) => {
      const o = (p.origem || '').trim()
      if (o) count.set(o, (count.get(o) ?? 0) + 1)
    })
    const sorted = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    const max = Math.max(1, ...sorted.map(([, n]) => n))
    return { sorted, max }
  }, [funil, patients])

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">Relatórios</div>
        <Dropdown label="Período" value={periodo} options={PERIODOS} onChange={setPeriodo} active />
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* KPIs */}
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Kpi label="Atendimentos concluídos" value={String(stats.concluidos)} sub={`de ${stats.total} no período`} tone="#16a34a" />
          <Kpi label="Taxa de faltas" value={`${stats.taxaFaltas}%`} sub={`${stats.faltas} falta${stats.faltas === 1 ? '' : 's'}`} tone={stats.taxaFaltas > 15 ? '#dc2626' : '#d97706'} />
          <Kpi label="Ocupação da agenda" value={`${stats.ocupacao}%`} sub="horas agendadas ÷ expediente" tone="#3f6bf5" />
          <Kpi label="Faturamento recebido" value={brMoney(stats.faturado)} sub="parcelas + receitas pagas" tone="#3f6bf5" />
        </div>

        <div style={{ flex: 1, minHeight: 320, display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
          {/* Procedimentos mais realizados */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ font: "800 15px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 2 }}>Procedimentos mais realizados</div>
            <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#8b93a7', marginBottom: 16 }}>agendados e concluídos no período</div>
            {topProcs.sorted.length === 0 && <EmptyState icon="chart" title="Sem dados no período" desc="Nenhum atendimento registrado neste período." />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topProcs.sorted.map(([proc, n]) => (
                <div key={proc}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 5 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proc}</span>
                    <span className="tnum">{n}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 6, background: '#eef1f1' }}>
                    <div style={{ width: `${(n / topProcs.max) * 100}%`, height: '100%', borderRadius: 6, background: '#3f6bf5' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>
            {/* Por status */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 12 }}>Atendimentos por status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {porStatus.order.map((s) => {
                  const n = evPeriodo.filter((e) => e.status === s).length
                  if (!n) return null
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, flex: 'none', background: STATUS[s].dot }} />
                      <span style={{ flex: 1, font: "600 12.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>{STATUS[s].label}</span>
                      <div style={{ width: 110, height: 7, borderRadius: 6, background: '#eef1f1' }}>
                        <div style={{ width: `${(n / porStatus.max) * 100}%`, height: '100%', borderRadius: 6, background: STATUS[s].dot }} />
                      </div>
                      <span className="tnum" style={{ width: 26, textAlign: 'right', font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{n}</span>
                    </div>
                  )
                })}
                {evPeriodo.length === 0 && <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Sem atendimentos no período.</div>}
              </div>
            </div>

            {/* Por perfil */}
            <div className="card" style={{ padding: '16px 20px', flex: 1 }}>
              <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 12 }}>Atendimentos por perfil</div>
              <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: '#eef1f1', marginBottom: 12 }}>
                {porPerfil.counts.map(({ k, n }) => n > 0 && (
                  <div key={k} style={{ width: `${(n / porPerfil.tot) * 100}%`, background: PERFIL_KIND[k].color }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {porPerfil.counts.map(({ k, n }) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: PERFIL_KIND[k].color }} />
                    <span style={{ flex: 1, font: "600 12.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>{PERFIL_KIND[k].label}</span>
                    <span className="tnum" style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Relatórios segmentados */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 20 }}>
          {/* Faturamento por procedimento */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 2 }}>Faturamento por procedimento</div>
            <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#8b93a7', marginBottom: 14 }}>
              concluídos × tabela de preços · total {brMoney(procFat.total)}
            </div>
            {procFat.sorted.length === 0 && <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Nenhum procedimento concluído com preço no período.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {procFat.sorted.map(([proc, v]) => (
                <div key={proc}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 5 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proc}</span>
                    <span className="tnum" style={{ flex: 'none' }}>{brMoney(v)}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 6, background: '#eef1f1' }}>
                    <div style={{ width: `${(v / procFat.max) * 100}%`, height: '100%', borderRadius: 6, background: '#16a34a' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Faltas por dia da semana */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 2 }}>Faltas por dia da semana</div>
            <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#8b93a7', marginBottom: 14 }}>
              {faltasDia.total} falta{faltasDia.total === 1 ? '' : 's'} no período
            </div>
            {faltasDia.total === 0 ? (
              <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Nenhuma falta no período. 🎉</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
                  const n = faltasDia.counts[wd]
                  if (!n) return null
                  return (
                    <div key={wd} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 34, font: "600 12px 'Plus Jakarta Sans'", color: '#5b647a' }}>{WD_LABEL[wd]}</span>
                      <div style={{ flex: 1, height: 8, borderRadius: 6, background: '#eef1f1' }}>
                        <div style={{ width: `${(n / faltasDia.max) * 100}%`, height: '100%', borderRadius: 6, background: '#dc2626' }} />
                      </div>
                      <span className="tnum" style={{ width: 22, textAlign: 'right', font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{n}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Origem dos leads */}
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 2 }}>Origem de leads e pacientes</div>
            <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#8b93a7', marginBottom: 14 }}>como conheceram a clínica</div>
            {origens.sorted.length === 0 && <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Nenhum lead ou paciente com origem registrada.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {origens.sorted.map(([origem, n], i) => (
                <div key={origem} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, flex: 'none', background: ORIGEM_COLORS[i % ORIGEM_COLORS.length] }} />
                  <span style={{ flex: 1, font: "600 12.5px 'Plus Jakarta Sans'", color: '#5b647a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{origem}</span>
                  <div style={{ width: 90, height: 7, borderRadius: 6, background: '#eef1f1' }}>
                    <div style={{ width: `${(n / origens.max) * 100}%`, height: '100%', borderRadius: 6, background: ORIGEM_COLORS[i % ORIGEM_COLORS.length] }} />
                  </div>
                  <span className="tnum" style={{ width: 22, textAlign: 'right', font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const WD_LABEL = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const ORIGEM_COLORS = ['#3f6bf5', '#c2478a', '#d97706', '#16a34a', '#0f766e', '#64748b']

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  return (
    <div className="card card-hover" style={{ padding: '17px 18px' }}>
      <div style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#8b93a7' }}>{label}</div>
      <div className="tnum" style={{ font: "800 26px 'Plus Jakarta Sans'", color: '#26324a', margin: '7px 0 5px' }}><CountUp value={value} /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: tone }} />
        <span style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>{sub}</span>
      </div>
    </div>
  )
}
