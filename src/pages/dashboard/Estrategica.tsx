import { useEffect, useMemo, useState } from 'react'
import { StatCard } from '../../components/ui'
import { useStore, matchFicha } from '../../store'
import { supabase } from '../../lib/supabase'
import { todayISO, parseISO, isVencidaBr } from '../../lib/dates'
import { dayRange } from '../../lib/horarios'
import { brMoney, parseMoney } from '../../lib/money'

/**
 * Visão estratégica do mês (padrão Clinicorp): ocupação da agenda, faturamento,
 * conversão de planos e inadimplência — calculados dos dados existentes.
 */

const DAY_MS = 86400000

/** "dd/mm/aaaa" → ISO, ou '' se inválido. */
const brToIso = (s: string) => {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || '')
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

export default function Estrategica() {
  const { events, horarios, procedimentos } = useStore()
  const [faturado, setFaturado] = useState<number | null>(null)
  const [planos, setPlanos] = useState<{ aprovados: number; total: number } | null>(null)
  const [inadimplencia, setInadimplencia] = useState<{ total: number; n: number } | null>(null)

  const today = todayISO()
  const now = parseISO(today)
  const monthFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const inMonth = (iso: string) => !!iso && iso >= monthFrom && iso <= today

  useEffect(() => {
    const sb = supabase
    if (!sb) return
    let cancelled = false
    Promise.all([
      sb.from('installments').select('venc,val,status'),
      sb.from('finance_entries').select('entry_date,value,type,status').eq('type', 'receita').eq('status', 'pago'),
      sb.from('plans').select('status'),
    ]).then(([iR, fR, pR]) => {
      if (cancelled) return
      if (!iR.error && iR.data) {
        const pagas = iR.data.filter((r) => r.status === 'pago' && inMonth(brToIso((r.venc as string) ?? '')))
          .reduce((s, r) => s + parseMoney((r.val as string) ?? ''), 0)
        const receitas = !fR.error && fR.data
          ? fR.data.filter((r) => inMonth(brToIso((r.entry_date as string) ?? ''))).reduce((s, r) => s + (Number(r.value) || 0), 0)
          : 0
        setFaturado(pagas + receitas)
        const vencidas = iR.data.filter((r) => r.status !== 'pago' && (r.status === 'vencida' || isVencidaBr((r.venc as string) ?? '')))
        setInadimplencia({ total: vencidas.reduce((s, r) => s + parseMoney((r.val as string) ?? ''), 0), n: vencidas.length })
      }
      if (!pR.error && pR.data && pR.data.length > 0) {
        setPlanos({ aprovados: pR.data.filter((r) => r.status === 'aprovado').length, total: pR.data.length })
      }
    }).catch((e) => console.error('[supabase] estrategica', e))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stats = useMemo(() => {
    const doMes = events.filter((e) => inMonth(e.date))
    const ativos = doMes.filter((e) => e.status !== 'desmarcado' && e.status !== 'faltou')

    // ocupação: horas agendadas ÷ horas de expediente (mês até hoje)
    let expediente = 0
    for (let t = parseISO(monthFrom).getTime(); t <= now.getTime(); t += DAY_MS) {
      const d = new Date(t)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const r = dayRange(horarios, iso)
      if (r) expediente += r.end - r.start
    }
    const agendadas = ativos.reduce((s, e) => s + e.dur, 0)
    const ocupacao = expediente ? Math.min(100, Math.round((agendadas / expediente) * 100)) : 0

    // fallback de faturamento sem banco: soma dos atendimentos concluídos × tabela de preços
    const estimado = doMes.filter((e) => e.status === 'concluido')
      .reduce((s, e) => s + (matchFicha(procedimentos, e.proc)?.val ?? 0), 0)

    return { ocupacao, estimado }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, horarios, procedimentos, monthFrom, today])

  const fatValue = faturado ?? stats.estimado
  const convPct = planos && planos.total > 0 ? Math.round((planos.aprovados / planos.total) * 100) : null

  const cards = [
    {
      label: 'Ocupação da agenda',
      value: `${stats.ocupacao}%`,
      sub: 'horas agendadas ÷ expediente',
      tone: stats.ocupacao >= 60 ? '#16a34a' : '#d97706',
    },
    {
      label: 'Faturamento do mês',
      value: brMoney(fatValue),
      sub: faturado != null ? 'recebido no mês' : 'estimado dos atendimentos concluídos',
      tone: '#16a34a',
    },
    {
      label: 'Conversão de planos',
      value: convPct != null ? `${convPct}%` : '—',
      sub: planos ? `${planos.aprovados} de ${planos.total} plano${planos.total === 1 ? '' : 's'} aprovado${planos.aprovados === 1 ? '' : 's'}` : 'sem planos registrados',
      tone: '#d97706',
    },
    {
      label: 'Inadimplência',
      value: inadimplencia ? brMoney(inadimplencia.total) : '—',
      sub: inadimplencia ? `${inadimplencia.n} parcela${inadimplencia.n === 1 ? '' : 's'} vencida${inadimplencia.n === 1 ? '' : 's'}` : 'sem dados do financeiro',
      tone: inadimplencia && inadimplencia.n > 0 ? '#dc2626' : '#16a34a',
    },
  ]

  return (
    <div style={{ flex: 'none' }}>
      <div style={{ font: "700 12px 'Plus Jakarta Sans'", color: '#8a9699', margin: '2px 0 10px', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        Visão estratégica · mês atual
      </div>
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>
    </div>
  )
}
