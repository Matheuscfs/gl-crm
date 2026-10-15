import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { Menu, Dropdown } from '../components/Menu'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Field, TextInput, Select } from '../components/Field'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { DEMO_DATA } from '../lib/demo'
import { EmptyState } from '../components/States'
import { parcelas as seedParcelas, PARCELA_STATUS, FIN_CATEGORIAS, type ParcelaStatus } from '../data'
import { parseMoney, brMoney } from '../lib/money'
import { exportCsv } from '../lib/exportCsv'
import { isVencidaBr, todayISO, brDate, brToIso, diffDays } from '../lib/dates'
import { DateField } from '../components/DateField'
import { useStore } from '../store'
import { PrintDoc } from '../components/PrintDoc'
import { ReciboModal, ReciboDoc, type ReciboDraft, type ClinicInfo } from '../components/Recibo'
import { listRecibos, createRecibo, carneLeaoRows, CARNE_LEAO_HEADERS, type Recibo } from '../lib/recibos'
import { pixPayload } from '../lib/pix'
import { waLink, contactPhone } from '../lib/whats'
import { Icon } from '../icons'
import { BRAND } from '../brand'

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const TODOS = 'Todos os meses'
// do 3º mês à frente até 6 meses atrás: as parcelas de um plano novo vencem nos meses seguintes
const MONTHS = [TODOS, ...Array.from({ length: 10 }, (_, i) => {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() + 3 - i, 1)
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
})]
const MES_ATUAL = (() => { const d = new Date(); return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` })()
const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "05/07/2026" → {m:6, y:2026} (m 0-based) ; retorna null se inválido. */
const parseBrDate = (s: string): { m: number; y: number } | null => {
  const mt = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s || '')
  return mt ? { m: Number(mt[2]) - 1, y: Number(mt[3]) } : null
}
/** "Julho 2026" → {m:6, y:2026} */
const parseMonthLabel = (label: string): { m: number; y: number } | null => {
  const [name, year] = label.split(' ')
  const m = MONTH_NAMES.indexOf(name)
  return m >= 0 && year ? { m, y: Number(year) } : null
}

interface Row { id: string; resp: string; ref: string; venc: string; val: string; status: ParcelaStatus; patientId?: string }

/** "vencida" é derivado do vencimento — nada grava esse status no banco. */
const deriveStatus = (status: ParcelaStatus, venc: string): ParcelaStatus =>
  status === 'aberto' && isVencidaBr(venc) ? 'vencida' : status
interface Entry { id: string; date: string; type: 'receita' | 'despesa'; description: string; category: string; value: number; status: 'pago' | 'aberto' }

type FiltroSituacao = 'todas' | ParcelaStatus
const FILTROS: { key: FiltroSituacao; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'vencida', label: 'Vencidas' },
  { key: 'aberto', label: 'Em aberto' },
  { key: 'pago', label: 'Pagas' },
]
const SITUACAO: Record<ParcelaStatus, { label: string; cls: string }> = {
  vencida: { label: 'Vencida', cls: 'danger' },
  aberto: { label: 'Em aberto', cls: 'warn' },
  pago: { label: 'Paga', cls: 'ok' },
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export default function Financeiro() {
  const { toast } = useToast()
  const { patients } = useStore()
  const [month, setMonth] = useState(MES_ATUAL)
  const [situacao, setSituacao] = useState<FiltroSituacao>('todas')
  // parcelas de demonstração só sem banco configurado — com banco, o que vale é o que está gravado
  const [rows, setRows] = useState<Row[]>(DEMO_DATA ? seedParcelas.map((p, i) => ({ id: `seed-${i}`, ...p, status: deriveStatus(p.status, p.venc) })) : [])
  const [entries, setEntries] = useState<Entry[]>([])
  const [entryModal, setEntryModal] = useState<'receita' | 'despesa' | null>(null)
  const [excluindo, setExcluindo] = useState<Entry | null>(null)
  const [form, setForm] = useState({ description: '', cat: '', sub: '', value: '', date: todayISO(), status: 'pago' as 'pago' | 'aberto' })
  const [clinic, setClinic] = useState<ClinicInfo & { pixKey: string }>({ name: BRAND.clinic, cro: BRAND.cro, cnpj: '', cpf: '', address: BRAND.city, pixKey: '' })
  // recibos: rascunho em edição, recibo emitido (impressão) e histórico
  const [draft, setDraft] = useState<ReciboDraft | null>(null)
  const [emitindo, setEmitindo] = useState(false)
  const [recibo, setRecibo] = useState<Recibo | null>(null)
  const [recibos, setRecibos] = useState<Recibo[]>([])
  const [verRecibos, setVerRecibos] = useState(false)
  const hoje = todayISO()

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    supabase.from('installments').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (cancelled) return
      if (error) { toast('Não foi possível carregar as parcelas. Verifique a conexão.', 'error'); return }
      if (!data || data.length === 0) return
      setRows(data.map((r) => ({ id: r.id as string, resp: (r.resp as string) ?? '—', ref: (r.ref as string) ?? '', venc: (r.venc as string) ?? '', val: (r.val as string) ?? '', status: deriveStatus((r.status as ParcelaStatus) ?? 'aberto', (r.venc as string) ?? ''), patientId: (r.patient_id as string) ?? undefined })))
    })
    supabase.from('clinic_settings').select('*').maybeSingle().then(({ data, error }) => {
      if (cancelled || error || !data) return
      setClinic({ name: data.name ?? BRAND.clinic, cro: data.cro ?? BRAND.cro, cnpj: data.cnpj ?? '', cpf: (data.cpf as string | null) ?? '', address: data.address ?? BRAND.city, pixKey: (data.pix_key as string | null) ?? '' })
    })
    listRecibos().then((rs) => { if (!cancelled) setRecibos(rs) })
    supabase.from('finance_entries').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (cancelled || error || !data) return
      setEntries(data.map((r) => ({ id: r.id as string, date: (r.entry_date as string) ?? '', type: (r.type as 'receita' | 'despesa') ?? 'receita', description: (r.description as string) ?? '', category: (r.category as string) ?? '', value: Number(r.value) || 0, status: (r.status as 'pago' | 'aberto') ?? 'pago' })))
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setStatus = (id: string, status: ParcelaStatus, msg: string) => {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, status: deriveStatus(status, p.venc) } : p)))
    if (supabase && !id.startsWith('seed-')) supabase.from('installments').update({ status }).eq('id', id).then(({ error }) => { if (error) toast('Não foi possível salvar a situação da parcela.', 'error') })
    toast(msg)
  }

  /** Paciente da parcela: pelo patient_id ou casando o nome do responsável com o cadastro. */
  const patientFor = (r: Row) => {
    const byId = r.patientId ? patients.find((p) => (p as { _id?: string })._id === r.patientId) : undefined
    if (byId) return byId
    const respNorm = r.resp.trim().toLowerCase()
    return patients.find((p) => (p.resp ?? '').split('·')[0].trim().toLowerCase() === respNorm || p.name.toLowerCase() === respNorm)
  }

  /** Telefone do responsável da parcela. */
  const phoneFor = (r: Row): string => contactPhone(patientFor(r))

  /** Abre o recibo já preenchido a partir de uma parcela. */
  const pedirRecibo = (r: Row) => {
    const pat = patientFor(r)
    // pediátrico cobra do responsável: o CPF do recibo é o de quem paga
    const cpf = (pat?.respCpf?.trim() || pat?.cpf || '').trim()
    setDraft({
      payerName: r.resp && r.resp !== '—' ? r.resp.split('·')[0].trim() : (pat?.name ?? ''),
      payerCpf: cpf,
      description: r.ref ? `Tratamento odontológico — ${r.ref}` : 'Tratamento odontológico',
      value: r.val,
      // o recibo é do dia em que o dinheiro entrou, não do vencimento (Carnê-Leão no mês certo)
      issuedOn: hoje,
      origin: 'parcela',
      refId: r.id,
      patientId: (pat as { _id?: string } | undefined)?._id,
    })
  }

  /** Abre o recibo a partir de um lançamento de receita. */
  const reciboDeEntrada = (e: Entry) => setDraft({
    payerName: '',
    payerCpf: '',
    description: e.description,
    value: e.value.toFixed(2).replace('.', ','),
    issuedOn: brToIso(e.date) || hoje,
    origin: 'lancamento',
    refId: e.id,
  })

  const emitirRecibo = async () => {
    if (!draft) return
    const value = parseMoney(draft.value)
    if (!draft.payerName.trim()) return toast('Informe quem consta como pagador.', 'error')
    if (!(value > 0)) return toast('Informe um valor maior que zero.', 'error')
    setEmitindo(true)
    const ultimo = recibos.reduce((m, r) => Math.max(m, r.number), 0)
    const novo = await createRecibo({ ...draft, payerName: draft.payerName.trim(), value }, ultimo)
    setEmitindo(false)
    setRecibos((prev) => [novo, ...prev])
    setDraft(null)
    setRecibo(novo)
    toast(`Recibo nº ${String(novo.number).padStart(4, '0')} emitido.`)
  }

  const exportarCarneLeao = () => {
    if (!recibos.length) return toast('Nenhum recibo emitido ainda.', 'error')
    exportCsv('carne-leao-recibos', CARNE_LEAO_HEADERS, carneLeaoRows(recibos))
    toast(`${recibos.length} recibo(s) exportado(s) para o Carnê-Leão.`)
  }

  const pixFor = (r: Row): string | null => {
    if (!clinic.pixKey.trim()) return null
    return pixPayload({ key: clinic.pixKey, name: clinic.name, city: clinic.address, amount: parseMoney(r.val), txid: r.ref })
  }

  const cobrar = (r: Row) => {
    const pix = pixFor(r)
    const quem = r.resp.split('·')[0].trim()
    const msg = `Oi, ${quem}! 😊 Passando para lembrar da parcela de ${brMoney(parseMoney(r.val))} (${r.ref}) com vencimento em ${r.venc}.`
      + (pix ? `\n\nSe preferir, pague por PIX copia e cola:\n${pix}` : '')
      + `\n\nQualquer dúvida, estamos à disposição! 🦷`
    const link = waLink(phoneFor(r), msg)
    if (!link) return toast(`Sem telefone cadastrado para ${r.resp}. Complete o cadastro do paciente.`, 'error')
    window.open(link, '_blank', 'noopener')
    toast(`Cobrança aberta no WhatsApp para ${quem}.`)
  }

  const copiarPix = (r: Row) => {
    const pix = pixFor(r)
    if (!pix) return toast('Cadastre a chave PIX em Configurações → Perfil da clínica.', 'error')
    navigator.clipboard.writeText(pix).then(
      () => toast(`PIX copia e cola de ${brMoney(parseMoney(r.val))} copiado.`),
      () => toast('Não foi possível copiar. Tente novamente.', 'error'),
    )
  }

  const novoLancamento = (tipo: 'receita' | 'despesa') => {
    setForm({ description: '', cat: '', sub: '', value: '', date: hoje, status: tipo === 'receita' ? 'pago' : 'aberto' })
    setEntryModal(tipo)
  }

  const saveEntry = () => {
    if (!entryModal) return
    const valor = parseMoney(form.value)
    if (!form.description.trim() || !valor) return toast('Informe descrição e valor.', 'error')
    if (valor < 0) return toast('O valor não pode ser negativo. Use − Despesa para saídas.', 'error')
    if (!form.date) return toast('Informe a data do lançamento.', 'error')
    const temp = `tmp-${Date.now()}`
    const category = form.cat ? `${form.cat}${form.sub ? ` · ${form.sub}` : ''}` : 'Geral'
    const entry: Entry = { id: temp, date: brDate(form.date), type: entryModal, description: form.description.trim(), category, value: valor, status: form.status }
    setEntries((prev) => [entry, ...prev])
    if (supabase) {
      supabase.from('finance_entries').insert({ entry_date: entry.date, type: entry.type, description: entry.description, category: entry.category, value: entry.value, status: entry.status }).select('id').single().then(({ data, error }) => {
        if (error) {
          // não deixa na tela um lançamento que não foi gravado
          setEntries((prev) => prev.filter((e) => e.id !== temp))
          return toast('Não foi possível salvar o lançamento. Verifique a conexão.', 'error')
        }
        if (data) setEntries((prev) => prev.map((e) => (e.id === temp ? { ...e, id: (data as { id: string }).id } : e)))
      })
    }
    setEntryModal(null)
    toast(entryModal === 'receita' ? 'Receita lançada.' : 'Despesa lançada.')
  }
  const removeEntry = (e: Entry) => {
    setEntries((prev) => prev.filter((x) => x.id !== e.id))
    if (supabase && !e.id.startsWith('tmp-')) {
      supabase.from('finance_entries').delete().eq('id', e.id).then(({ error }) => {
        if (!error) return
        setEntries((prev) => [e, ...prev])
        toast('Não foi possível excluir o lançamento.', 'error')
      })
    }
    toast('Lançamento removido.')
  }

  // filtro de período (aplica-se às tabelas e aos indicadores do mês)
  const sel = useMemo(() => parseMonthLabel(month), [month])
  const inPeriod = (dateStr: string) => {
    if (!sel) return true
    const d = parseBrDate(dateStr)
    return d ? d.m === sel.m && d.y === sel.y : true
  }
  const fRows = useMemo(() => rows.filter((r) => inPeriod(r.venc)), [rows, sel]) // eslint-disable-line react-hooks/exhaustive-deps
  const fEntries = useMemo(() => entries.filter((e) => inPeriod(e.date)), [entries, sel]) // eslint-disable-line react-hooks/exhaustive-deps
  // vencidas primeiro, depois em aberto pelo vencimento mais próximo; pagas por último, mais recentes antes
  const tabela = useMemo(() => {
    const ordem: Record<ParcelaStatus, number> = { vencida: 0, aberto: 1, pago: 2 }
    const lista = situacao === 'todas' ? fRows : fRows.filter((r) => r.status === situacao)
    return [...lista].sort((a, b) => ordem[a.status] - ordem[b.status]
      || (a.status === 'pago' ? brToIso(b.venc).localeCompare(brToIso(a.venc)) : brToIso(a.venc).localeCompare(brToIso(b.venc))))
  }, [fRows, situacao])

  const totReceita = fEntries.filter((e) => e.type === 'receita').reduce((s, e) => s + e.value, 0)
  const totDespesa = fEntries.filter((e) => e.type === 'despesa').reduce((s, e) => s + e.value, 0)

  // vencidas de qualquer mês: inadimplência não some ao trocar o período
  const vencidas = useMemo(() => rows.filter((r) => r.status === 'vencida').sort((a, b) => brToIso(a.venc).localeCompare(brToIso(b.venc))), [rows])
  const totalVencido = vencidas.reduce((s, r) => s + parseMoney(r.val), 0)
  const maisAntiga = vencidas[0]

  const kpi = useMemo(() => {
    const abertas = fRows.filter((r) => r.status === 'aberto')
    const aReceber = abertas.reduce((s, r) => s + parseMoney(r.val), 0)
    const pagos = fRows.filter((r) => r.status === 'pago')
    const recebidoParcelas = pagos.reduce((s, r) => s + parseMoney(r.val), 0)
    const recebido = recebidoParcelas + fEntries.filter((e) => e.type === 'receita' && e.status === 'pago').reduce((s, e) => s + e.value, 0)
    const ticket = pagos.length ? recebidoParcelas / pagos.length : 0
    return { aReceber, recebido, ticket, nAberto: abertas.length, nPagas: pagos.length }
  }, [fRows, fEntries])

  // gráfico — recebido por mês (parcelas pagas + receitas pagas), últimos 7 meses
  const chart = useMemo(() => {
    const byMonth = new Map<string, number>()
    const add = (dateStr: string, val: number) => {
      const d = parseBrDate(dateStr)
      if (!d) return
      const key = `${d.y}-${d.m}`
      byMonth.set(key, (byMonth.get(key) ?? 0) + val)
    }
    rows.filter((r) => r.status === 'pago').forEach((r) => add(r.venc, parseMoney(r.val)))
    entries.filter((e) => e.type === 'receita' && e.status === 'pago').forEach((e) => add(e.date, e.value))
    const now = new Date()
    const base = new Date(now.getFullYear(), now.getMonth(), 1)
    const series = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() - (6 - i), 1)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      return { m: MONTH_ABBR[d.getMonth()], val: byMonth.get(key) ?? 0 }
    })
    const max = Math.max(1, ...series.map((s) => s.val))
    return { series, max }
  }, [rows, entries])

  const porSituacao = useMemo(() => {
    const val = (st: ParcelaStatus) => fRows.filter((r) => r.status === st).reduce((s, r) => s + parseMoney(r.val), 0)
    const pago = val('pago'), aberto = val('aberto'), venc = val('vencida')
    const tot = pago + aberto + venc
    return {
      tot,
      itens: [
        { label: 'Recebido', val: pago, color: 'var(--green)' },
        { label: 'Em aberto', val: aberto, color: 'var(--amber)' },
        { label: 'Vencido', val: venc, color: 'var(--danger)' },
      ],
    }
  }, [fRows])

  const exportarCsv = () => {
    const suffix = sel ? month.replace(' ', '-') : 'completo'
    const headers = ['Tipo', 'Responsável/Descrição', 'Referência/Categoria', 'Data', 'Valor', 'Status']
    const parcRows = fRows.map((r) => ['Parcela', r.resp, r.ref, r.venc, brMoney(parseMoney(r.val)), PARCELA_STATUS[r.status].label])
    const entRows = fEntries.map((e) => [e.type === 'receita' ? 'Receita' : 'Despesa', e.description, e.category, e.date, brMoney(e.value), e.status === 'pago' ? 'Pago' : 'Em aberto'])
    exportCsv(`financeiro-${suffix}`, headers, [...parcRows, ...entRows])
    toast(`Relatório exportado (${parcRows.length + entRows.length} lançamentos).`)
  }

  /** Vencimento: data + quanto falta, há quanto venceu ou "pago". */
  const vencSub = (r: Row) => {
    if (r.status === 'pago') return <span className="cell-sub">paga</span>
    const iso = brToIso(r.venc)
    if (!iso) return null
    const d = diffDays(hoje, iso)
    if (r.status === 'vencida') return <span className="cell-sub danger">há {plural(-d, 'dia', 'dias')}</span>
    return <span className={`cell-sub${d <= 7 ? ' info' : ''}`}>{d === 0 ? 'vence hoje' : d === 1 ? 'vence amanhã' : `em ${plural(d, 'dia', 'dias')}`}</span>
  }

  const acaoPrincipal = (r: Row) => {
    if (r.status === 'vencida') return <button className="btn-line danger" onClick={() => cobrar(r)}>Cobrar</button>
    if (r.status === 'aberto') return <button className="btn-line" onClick={() => copiarPix(r)}>Copiar PIX</button>
    return <button className="btn-line" onClick={() => pedirRecibo(r)}>Recibo</button>
  }

  const verVencidas = () => { setMonth(TODOS); setSituacao('vencida') }
  const atual = chart.series[chart.series.length - 1]

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Financeiro</h1>
          <p className="topbar-sub">{month === TODOS ? 'Todos os meses' : month.replace(' ', ' de ')} · recebido conta pelo vencimento da parcela</p>
        </div>
        <div className="topbar-actions">
          <Dropdown label="Período" value={month} options={MONTHS} onChange={setMonth} active />
          <button className="btn-soft" style={{ height: 40, padding: '0 14px', borderRadius: 11 }} onClick={exportarCsv}>Exportar</button>
          <button className="btn-soft" style={{ height: 40, padding: '0 14px', borderRadius: 11 }} onClick={() => novoLancamento('despesa')}>− Despesa</button>
          <button className="btn-cta" onClick={() => novoLancamento('receita')}><Icon name="plus" size={16} /> Receita</button>
        </div>
      </header>

      <div className="page-body">
        {/* destaque: o que está vencido, de qualquer mês */}
        <section className="panel hero" aria-live="polite">
          {vencidas.length > 0 && maisAntiga ? (
            <>
              <div>
                <p className="hero-text"><span className="alert">{brMoney(totalVencido)} vencidos</span> aguardam cobrança.</p>
                <p className="hero-sub">
                  {plural(vencidas.length, 'parcela', 'parcelas')} · a mais antiga: {maisAntiga.resp.split('·')[0].trim()}, venceu em {maisAntiga.venc}
                  {clinic.pixKey.trim() ? ' · PIX copia e cola pronto' : ' · cadastre a chave PIX em Configurações para mandar junto'}
                </p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button className="btn-soft" style={{ height: 40, padding: '0 14px', borderRadius: 11 }} onClick={verVencidas}>Ver vencidas</button>
                <button className="btn-cta" onClick={() => cobrar(maisAntiga)}><Icon name="wa" size={16} /> Cobrar {maisAntiga.resp.split(' ')[0]}</button>
              </div>
            </>
          ) : (
            <div>
              <p className="hero-text"><span className="ok">Nenhuma parcela vencida.</span></p>
              <p className="hero-sub">{kpi.nAberto ? `${brMoney(kpi.aReceber)} a receber em ${plural(kpi.nAberto, 'parcela', 'parcelas')} neste período.` : 'Nada em aberto neste período.'}</p>
            </div>
          )}
        </section>

        <section aria-label="Indicadores" style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          <div className="panel kpi-flat" style={{ flex: '1 1 190px' }}>
            <div className="l">{sel ? 'Recebido no mês' : 'Recebido'}</div>
            <div className="v">{brMoney(kpi.recebido)}</div>
            <div className="s">{plural(kpi.nPagas, 'parcela paga', 'parcelas pagas')} + receitas</div>
          </div>
          <div className="panel kpi-flat" style={{ flex: '1 1 190px' }}>
            <div className="l">{sel ? 'A receber no mês' : 'A receber'}</div>
            <div className="v">{brMoney(kpi.aReceber)}</div>
            <div className="s">{plural(kpi.nAberto, 'parcela em aberto', 'parcelas em aberto')}</div>
          </div>
          <div className={`panel kpi-flat${totalVencido > 0 ? ' danger' : ''}`} style={{ flex: '1 1 190px' }}>
            <div className="l">Vencido (todos os meses)</div>
            <div className="v">{brMoney(totalVencido)}</div>
            <div className="s">{vencidas.length ? `${plural(vencidas.length, 'parcela', 'parcelas')} · cobrar` : 'nada vencido'}</div>
          </div>
          <div className="panel kpi-flat" style={{ flex: '1 1 190px' }}>
            <div className="l">Ticket médio</div>
            <div className="v">{brMoney(kpi.ticket)}</div>
            <div className="s">por parcela paga</div>
          </div>
        </section>

        <div className="home-cols">
          <section className="panel flush home-main" aria-labelledby="receber-titulo">
            <div className="panel-head">
              <h2 id="receber-titulo" className="panel-title">Contas a receber</h2>
              <div className="seg-sm" role="group" aria-label="Filtrar por situação">
                {FILTROS.map((f) => {
                  const n = f.key === 'todas' ? fRows.length : fRows.filter((r) => r.status === f.key).length
                  return (
                    <button key={f.key} aria-pressed={situacao === f.key} onClick={() => setSituacao(f.key)}>
                      {f.label}<span className={`n${f.key === 'vencida' && n ? ' alert' : ''}`}>{n}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="qtable">
              <div style={{ minWidth: 720 }} role="table" aria-label="Parcelas">
                <div className="frow head" role="row">
                  <span role="columnheader">Responsável</span><span role="columnheader">Referência</span><span role="columnheader">Vencimento</span>
                  <span role="columnheader" className="num">Valor</span><span role="columnheader">Situação</span><span role="columnheader"><span className="visually-hidden">Ações</span></span>
                </div>
                {tabela.length === 0 && (
                  <EmptyState icon="dollar" title={situacao === 'todas' ? 'Sem contas a receber' : 'Nada nesta situação'}
                    desc={sel ? 'Nenhuma parcela neste período. Troque o período em cima para ver outros meses.' : 'As parcelas aparecem aqui quando um plano é aprovado.'} />
                )}
                {tabela.map((r) => (
                  <div key={r.id} className={`frow${r.status === 'vencida' ? ' hot' : ''}`} role="row">
                    <span className="q-text" role="cell"><span className="q-main">{r.resp}</span></span>
                    <span className="q-text" role="cell"><span className="q-sub" style={{ color: 'var(--slate)', fontSize: 12.5 }}>{r.ref}</span></span>
                    <span className="q-text" role="cell"><span className="cell-main">{r.venc}</span>{vencSub(r)}</span>
                    <span role="cell" className="num q-main" style={{ fontWeight: 600 }}>{brMoney(parseMoney(r.val))}</span>
                    <span role="cell"><span className={`q-reason ${SITUACAO[r.status].cls}`}>{SITUACAO[r.status].label}</span></span>
                    <span className="row-actions" role="cell">
                      {acaoPrincipal(r)}
                      <Menu width={230} items={[
                        { label: 'Marcar como pago', disabled: r.status === 'pago', onClick: () => { setStatus(r.id, 'pago', `Parcela de ${r.resp} marcada como paga.`); pedirRecibo(r) } },
                        { label: 'Cobrar por WhatsApp', disabled: r.status === 'pago', onClick: () => cobrar(r) },
                        { label: 'Copiar PIX copia e cola', disabled: r.status === 'pago', onClick: () => copiarPix(r) },
                        { label: 'Emitir recibo', disabled: r.status !== 'pago', onClick: () => pedirRecibo(r) },
                        { label: 'Reabrir', disabled: r.status !== 'pago', onClick: () => setStatus(r.id, 'aberto', 'Parcela reaberta.') },
                      ]} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="list-foot">
              <span>O recibo sai com a data do dia em que é emitido. Cada recibo entra no relatório do Carnê-Leão.</span>
            </div>
          </section>

          <aside className="home-aside" aria-label="Resumo financeiro">
            <section className="panel">
              <div className="panel-head"><h2 className="panel-title sm">Recebido · 7 meses</h2></div>
              <div className="big-num"><b className="md">{brMoney(atual.val)}</b><span>em {MONTH_NAMES[new Date().getMonth()].toLowerCase()}</span></div>
              <div className="vbars" role="img" aria-label={`Recebido por mês: ${chart.series.map((s) => `${s.m} ${brMoney(s.val)}`).join(', ')}`}>
                {chart.series.map((b, i) => (
                  <div key={i} className={`vbar${i === chart.series.length - 1 ? ' atual' : ''}`} title={`${b.m}: ${brMoney(b.val)}`}>
                    <i style={{ height: `${Math.max(2, (b.val / chart.max) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="vbars-axis">{chart.series.map((b, i) => <span key={i} className={i === chart.series.length - 1 ? 'atual' : ''}>{b.m}</span>)}</div>
            </section>

            <section className="panel">
              <h2 className="panel-title sm">Parcelas por situação</h2>
              {porSituacao.tot === 0 ? (
                <p className="empty-note">Nenhuma parcela neste período.</p>
              ) : (
                <div className="hbars">
                  {porSituacao.itens.map((s) => (
                    <div key={s.label}>
                      <div className="hbar-top"><span>{s.label}</span><span className="tnum">{brMoney(s.val)}</span></div>
                      <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(s.val / porSituacao.tot) * 100}%`, background: s.color }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <h2 className="panel-title sm">Recibos e Carnê-Leão</h2>
              <p className="panel-sub" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                {recibos.length ? `${plural(recibos.length, 'recibo emitido', 'recibos emitidos')} · total ${brMoney(recibos.reduce((s, r) => s + r.value, 0))}.` : 'Nenhum recibo emitido ainda.'}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <button className="btn-soft" style={{ height: 38 }} onClick={() => setVerRecibos(true)}>Ver recibos</button>
                <button className="btn-soft" style={{ height: 38 }} disabled={!recibos.length} onClick={exportarCarneLeao}>Exportar CSV do Carnê-Leão</button>
              </div>
            </section>
          </aside>
        </div>

        {/* lançamentos manuais (receitas e despesas) */}
        <section className="panel flush" aria-labelledby="lanc-titulo">
          <div className="panel-head">
            <h2 id="lanc-titulo" className="panel-title">Lançamentos <span style={{ font: '400 12.5px var(--font)', color: 'var(--muted)' }}>receitas e despesas avulsas</span></h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', font: '500 12.5px var(--font)' }}>
              <span style={{ color: 'var(--green-dark)' }}>Receitas {brMoney(totReceita)}</span>
              <span style={{ color: 'var(--danger-text)' }}>Despesas {brMoney(totDespesa)}</span>
              <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Saldo {brMoney(totReceita - totDespesa)}</span>
            </div>
          </div>
          <div className="qtable">
            <div style={{ minWidth: 640 }} role="table" aria-label="Lançamentos">
              <div className="erow head" role="row">
                <span role="columnheader">Descrição</span><span role="columnheader">Categoria</span><span role="columnheader">Data</span>
                <span role="columnheader" className="num">Valor</span><span role="columnheader">Situação</span><span role="columnheader"><span className="visually-hidden">Ações</span></span>
              </div>
              {fEntries.length === 0 ? (
                <p className="qempty">{sel ? 'Nenhum lançamento neste período.' : 'Use + Receita ou − Despesa para lançar manualmente.'}</p>
              ) : fEntries.map((e) => (
                <div key={e.id} className="erow" role="row">
                  <span className="q-text" role="cell"><span className="q-main">{e.description}</span><span className="q-sub">{e.type === 'receita' ? 'receita' : 'despesa'}</span></span>
                  <span className="q-sub" role="cell" style={{ color: 'var(--slate)' }}>{e.category}</span>
                  <span className="cell-main" role="cell">{e.date}</span>
                  <span role="cell" className="num q-main" style={{ fontWeight: 600, color: e.type === 'receita' ? 'var(--green-dark)' : 'var(--danger-text)' }}>{e.type === 'receita' ? '+' : '−'} {brMoney(e.value)}</span>
                  <span role="cell"><span className={`q-reason ${e.status === 'pago' ? 'ok' : 'warn'}`}>{e.status === 'pago' ? 'Pago' : 'Em aberto'}</span></span>
                  <span role="cell" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Menu width={210} items={[
                      { label: 'Emitir recibo', disabled: e.type !== 'receita', onClick: () => reciboDeEntrada(e) },
                      { label: 'Excluir', danger: true, onClick: () => setExcluindo(e) },
                    ]} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog open={!!excluindo} onClose={() => setExcluindo(null)} onConfirm={() => { if (excluindo) removeEntry(excluindo) }}
        title="Excluir lançamento" message={`Excluir "${excluindo?.description ?? ''}" (${brMoney(excluindo?.value ?? 0)}, ${excluindo?.date ?? ''})?`} />

      <Modal open={!!entryModal} onClose={() => setEntryModal(null)} title={entryModal === 'despesa' ? 'Lançar despesa' : 'Lançar receita'} width={420} dirty={!!(form.description.trim() || form.value)}
        footer={<><Button variant="outline" onClick={() => setEntryModal(null)}>Cancelar</Button><Button onClick={saveEntry}>Lançar</Button></>}>
        <Field label="Descrição"><TextInput autoFocus value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={entryModal === 'despesa' ? 'Ex.: Compra de materiais' : 'Ex.: Recebimento particular'} /></Field>
        {(() => {
          const cats = FIN_CATEGORIAS[entryModal ?? 'receita']
          const subs = cats.find((c) => c.cat === form.cat)?.subs ?? []
          return (
            <div className="field-row">
              <Field label="Categoria">
                <Select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value, sub: '' })}>
                  <option value="">Selecione…</option>
                  {cats.map((c) => <option key={c.cat} value={c.cat}>{c.cat}</option>)}
                </Select>
              </Field>
              <Field label="Subcategoria">
                <Select value={form.sub} onChange={(e) => setForm({ ...form, sub: e.target.value })} disabled={!form.cat}>
                  <option value="">—</option>
                  {subs.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
          )
        })()}
        <div className="field-row">
          <Field label="Valor (R$)"><TextInput inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0,00" /></Field>
          <Field label="Data"><DateField value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} /></Field>
        </div>
        <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'pago' | 'aberto' })}><option value="pago">Pago</option><option value="aberto">Em aberto</option></Select></Field>
      </Modal>

      {/* Recibo: confirmação → gravação numerada → impressão */}
      <ReciboModal open={!!draft} draft={draft} onChange={setDraft} onClose={() => setDraft(null)} onEmit={emitirRecibo} saving={emitindo} />

      <PrintDoc open={!!recibo} title="Recibo" onClose={() => setRecibo(null)}>
        {recibo && <ReciboDoc recibo={recibo} clinic={clinic} />}
      </PrintDoc>

      {/* Recibos emitidos + exportação para o Carnê-Leão */}
      <Modal open={verRecibos} onClose={() => setVerRecibos(false)} title="Recibos emitidos" width={560}
        subtitle={recibos.length ? `${recibos.length} recibo(s) · total ${brMoney(recibos.reduce((s, r) => s + r.value, 0))}` : 'Nenhum recibo emitido ainda'}
        footer={
          <>
            <Button variant="outline" onClick={() => setVerRecibos(false)}>Fechar</Button>
            <Button variant="outline" onClick={() => { setVerRecibos(false); setDraft({ payerName: '', payerCpf: '', description: '', value: '', issuedOn: hoje, origin: 'avulso' }) }}>Recibo avulso</Button>
            <Button onClick={exportarCarneLeao} disabled={!recibos.length}>Exportar Carnê-Leão</Button>
          </>
        }>
        {recibos.length === 0 && (
          <div style={{ font: "400 12.5px var(--font)", color: 'var(--slate)' }}>
            Os recibos aparecem aqui conforme forem emitidos. O CSV de exportação traz data, CPF, nome, descrição e valor —
            o formato que o Carnê-Leão (e o script de importação) espera.
          </div>
        )}
        {recibos.map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
            <span className="tnum" style={{ font: "600 12px var(--font)", color: 'var(--muted)', width: 42 }}>#{String(r.number).padStart(4, '0')}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "500 13px var(--font)", color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.payerName}</div>
              <div style={{ font: "400 11.5px var(--font)", color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {brDate(r.issuedOn)} · {r.payerCpf || 'sem CPF'} · {r.description || '—'}
              </div>
            </div>
            <span className="tnum" style={{ font: "600 13px var(--font)", color: 'var(--green-dark)' }}>{brMoney(r.value)}</span>
            <Button size="sm" variant="ghost" onClick={() => { setVerRecibos(false); setRecibo(r) }}>Ver</Button>
          </div>
        ))}
      </Modal>
    </>
  )
}
