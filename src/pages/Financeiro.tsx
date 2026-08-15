import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { Menu, Dropdown } from '../components/Menu'
import { Modal } from '../components/Modal'
import { Field, TextInput, Select } from '../components/Field'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { EmptyState } from '../components/States'
import { parcelas as seedParcelas, PARCELA_STATUS, FIN_CATEGORIAS, type ParcelaStatus } from '../data'
import { parseMoney, brMoney } from '../lib/money'
import { exportCsv } from '../lib/exportCsv'
import { isVencidaBr, todayISO, brDate } from '../lib/dates'
import { DateField } from '../components/DateField'
import { CountUp } from '../components/ui'
import { useStore } from '../store'
import { PrintDoc } from '../components/PrintDoc'
import { pixPayload } from '../lib/pix'
import { waLink, contactPhone } from '../lib/whats'
import { BRAND } from '../brand'

const GRID = '1.4fr 1.6fr 1fr 0.9fr 1fr 34px'
const ENTRY_GRID = '2fr 1.2fr 1fr 0.9fr 0.9fr 34px'
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
// últimos 6 meses a partir do mês atual (a lista acompanha o calendário)
const MONTHS = ['Todos os meses', ...Array.from({ length: 6 }, (_, i) => {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
})]
const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

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

export default function Financeiro() {
  const { toast } = useToast()
  const { patients } = useStore()
  const [month, setMonth] = useState(MONTHS[0])
  const [rows, setRows] = useState<Row[]>(seedParcelas.map((p, i) => ({ id: `seed-${i}`, ...p, status: deriveStatus(p.status, p.venc) })))
  const [entries, setEntries] = useState<Entry[]>([])
  const [entryModal, setEntryModal] = useState<'receita' | 'despesa' | null>(null)
  const [form, setForm] = useState({ description: '', cat: '', sub: '', value: '', date: todayISO(), status: 'pago' as 'pago' | 'aberto' })
  const [recibo, setRecibo] = useState<Row | null>(null)
  const [clinic, setClinic] = useState({ name: BRAND.clinic, cro: BRAND.cro, cnpj: '', address: BRAND.city, pixKey: '' })

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    supabase.from('installments').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (cancelled || error || !data || data.length === 0) return
      setRows(data.map((r) => ({ id: r.id as string, resp: (r.resp as string) ?? '—', ref: (r.ref as string) ?? '', venc: (r.venc as string) ?? '', val: (r.val as string) ?? '', status: deriveStatus((r.status as ParcelaStatus) ?? 'aberto', (r.venc as string) ?? ''), patientId: (r.patient_id as string) ?? undefined })))
    })
    supabase.from('clinic_settings').select('*').maybeSingle().then(({ data, error }) => {
      if (cancelled || error || !data) return
      setClinic({ name: data.name ?? BRAND.clinic, cro: data.cro ?? BRAND.cro, cnpj: data.cnpj ?? '', address: data.address ?? BRAND.city, pixKey: (data.pix_key as string | null) ?? '' })
    })
    supabase.from('finance_entries').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (cancelled || error || !data) return
      setEntries(data.map((r) => ({ id: r.id as string, date: (r.entry_date as string) ?? '', type: (r.type as 'receita' | 'despesa') ?? 'receita', description: (r.description as string) ?? '', category: (r.category as string) ?? '', value: Number(r.value) || 0, status: (r.status as 'pago' | 'aberto') ?? 'pago' })))
    })
    return () => { cancelled = true }
  }, [])

  const setStatus = (id: string, status: ParcelaStatus, msg: string) => {
    setRows((prev) => prev.map((p) => (p.id === id ? { ...p, status: deriveStatus(status, p.venc) } : p)))
    if (supabase && !id.startsWith('seed-')) supabase.from('installments').update({ status }).eq('id', id).then(({ error }) => { if (error) console.error('[supabase] installments', error.message) })
    toast(msg)
  }

  /** Telefone do responsável da parcela: pelo patient_id ou casando o nome com o cadastro. */
  const phoneFor = (r: Row): string => {
    const byId = r.patientId ? patients.find((p) => (p as { _id?: string })._id === r.patientId) : undefined
    if (byId) return contactPhone(byId)
    const respNorm = r.resp.trim().toLowerCase()
    const byName = patients.find((p) => (p.resp ?? '').split('·')[0].trim().toLowerCase() === respNorm || p.name.toLowerCase() === respNorm)
    return contactPhone(byName)
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
    window.open(link, '_blank')
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

  const saveEntry = () => {
    if (!entryModal) return
    if (!form.description.trim() || !parseMoney(form.value)) return toast('Informe descrição e valor.', 'error')
    if (!form.date) return toast('Informe a data do lançamento.', 'error')
    const temp = `tmp-${Date.now()}`
    const category = form.cat ? `${form.cat}${form.sub ? ` · ${form.sub}` : ''}` : 'Geral'
    const entry: Entry = { id: temp, date: brDate(form.date), type: entryModal, description: form.description.trim(), category, value: parseMoney(form.value), status: form.status }
    setEntries((prev) => [entry, ...prev])
    if (supabase) supabase.from('finance_entries').insert({ entry_date: entry.date, type: entry.type, description: entry.description, category: entry.category, value: entry.value, status: entry.status }).select('id').single().then(({ data }) => { if (data) setEntries((prev) => prev.map((e) => (e.id === temp ? { ...e, id: (data as { id: string }).id } : e))) })
    setEntryModal(null)
    setForm({ description: '', cat: '', sub: '', value: '', date: todayISO(), status: 'pago' })
    toast(entryModal === 'receita' ? 'Receita lançada.' : 'Despesa lançada.')
  }
  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
    if (supabase && !id.startsWith('tmp-')) supabase.from('finance_entries').delete().eq('id', id).then(({ error }) => { if (error) console.error(error.message) })
    toast('Lançamento removido.')
  }

  // filtro de período (aplica-se às tabelas e KPIs)
  const sel = useMemo(() => parseMonthLabel(month), [month])
  const inPeriod = (dateStr: string) => {
    if (!sel) return true
    const d = parseBrDate(dateStr)
    return d ? d.m === sel.m && d.y === sel.y : true
  }
  const fRows = useMemo(() => rows.filter((r) => inPeriod(r.venc)), [rows, sel])
  const fEntries = useMemo(() => entries.filter((e) => inPeriod(e.date)), [entries, sel])

  const totReceita = fEntries.filter((e) => e.type === 'receita').reduce((s, e) => s + e.value, 0)
  const totDespesa = fEntries.filter((e) => e.type === 'despesa').reduce((s, e) => s + e.value, 0)

  // KPIs computados dos dados reais
  const kpi = useMemo(() => {
    const aReceber = fRows.filter((r) => r.status !== 'pago').reduce((s, r) => s + parseMoney(r.val), 0)
    const vencido = fRows.filter((r) => r.status === 'vencida').reduce((s, r) => s + parseMoney(r.val), 0)
    const recebidoParcelas = fRows.filter((r) => r.status === 'pago').reduce((s, r) => s + parseMoney(r.val), 0)
    const recebido = recebidoParcelas + fEntries.filter((e) => e.type === 'receita' && e.status === 'pago').reduce((s, e) => s + e.value, 0)
    const pagos = fRows.filter((r) => r.status === 'pago')
    const ticket = pagos.length ? recebidoParcelas / pagos.length : 0
    const nAberto = fRows.filter((r) => r.status !== 'pago').length
    const nVencido = fRows.filter((r) => r.status === 'vencida').length
    return { aReceber, vencido, recebido, ticket, nAberto, nVencido }
  }, [fRows, fEntries])

  // gráfico de faturamento — recebido por mês (parcelas pagas + receitas pagas)
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
    // últimos 7 meses a partir do mês atual
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

  // distribuição das parcelas por status (substitui o mock de formas de pagamento)
  const statusBreak = useMemo(() => {
    const val = (st: ParcelaStatus) => fRows.filter((r) => r.status === st).reduce((s, r) => s + parseMoney(r.val), 0)
    const pago = val('pago'), aberto = val('aberto'), venc = val('vencida')
    const tot = Math.max(1, pago + aberto + venc)
    return [
      { label: 'Recebido', pct: Math.round((pago / tot) * 100), color: '#16a34a' },
      { label: 'Em aberto', pct: Math.round((aberto / tot) * 100), color: '#3f6bf5' },
      { label: 'Vencido', pct: Math.round((venc / tot) * 100), color: '#dc2626' },
    ]
  }, [fRows])

  const exportarCsv = () => {
    const suffix = sel ? month.replace(' ', '-') : 'completo'
    const headers = ['Tipo', 'Responsável/Descrição', 'Referência/Categoria', 'Data', 'Valor', 'Status']
    const parcRows = fRows.map((r) => ['Parcela', r.resp, r.ref, r.venc, brMoney(parseMoney(r.val)), PARCELA_STATUS[r.status].label])
    const entRows = fEntries.map((e) => [e.type === 'receita' ? 'Receita' : 'Despesa', e.description, e.category, e.date, brMoney(e.value), e.status === 'pago' ? 'Pago' : 'Em aberto'])
    exportCsv(`financeiro-${suffix}`, headers, [...parcRows, ...entRows])
    toast(`Relatório exportado (${parcRows.length + entRows.length} lançamentos).`)
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">Financeiro</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Dropdown label="Período" value={month} options={MONTHS} onChange={setMonth} active />
          <Button variant="outline" onClick={() => { setForm({ description: '', cat: '', sub: '', value: '', date: todayISO(), status: 'aberto' }); setEntryModal('despesa') }}>− Despesa</Button>
          <Button variant="teal-soft" onClick={() => { setForm({ description: '', cat: '', sub: '', value: '', date: todayISO(), status: 'pago' }); setEntryModal('receita') }}>+ Receita</Button>
          <Button onClick={exportarCsv}>Exportar</Button>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <FinCard label={sel ? 'A receber (mês)' : 'A receber'} value={brMoney(kpi.aReceber)} dot="#d97706" sub={`${kpi.nAberto} parcela${kpi.nAberto === 1 ? '' : 's'} em aberto`} />
          <FinCard label={sel ? 'Recebido no mês' : 'Recebido'} value={brMoney(kpi.recebido)} dot="#16a34a" sub="parcelas + receitas pagas" />
          <FinCard label="Vencido" value={brMoney(kpi.vencido)} dot="#dc2626" sub={`${kpi.nVencido} parcela${kpi.nVencido === 1 ? '' : 's'} · cobrar`} valueColor="#a81e1e" subColor="#a81e1e" borderColor="#f1cccc" />
          <FinCard label="Ticket médio" value={brMoney(kpi.ticket)} dot="#3f6bf5" sub="por parcela paga" />
        </div>

        <div style={{ flex: 1, minHeight: 320, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px 12px', font: "800 15px 'Plus Jakarta Sans'", color: '#26324a', borderBottom: '1px solid #eff2f8' }}>Contas a receber</div>
            <div className="table-head" style={{ gridTemplateColumns: GRID, padding: '10px 20px' }}>
              <span>RESPONSÁVEL</span><span>REFERÊNCIA</span><span>VENCIMENTO</span><span style={{ textAlign: 'right' }}>VALOR</span><span style={{ textAlign: 'right' }}>STATUS</span><span />
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {fRows.length === 0 && <EmptyState icon="dollar" title="Sem contas a receber" desc={sel ? 'Nenhuma parcela vence neste período.' : 'As parcelas aparecem aqui quando um plano é aprovado.'} />}
              {fRows.map((p) => {
                const st = PARCELA_STATUS[p.status]
                return (
                  <div key={p.id} className="table-row" style={{ gridTemplateColumns: GRID, padding: '12px 20px' }}>
                    <span style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{p.resp}</span>
                    <span style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#5b647a' }}>{p.ref}</span>
                    <span className="tnum" style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>{p.venc}</span>
                    <span className="tnum" style={{ font: "700 13px 'Plus Jakarta Sans'", color: '#26324a', textAlign: 'right' }}>{p.val}</span>
                    <span style={{ textAlign: 'right' }}><span className="pill" style={{ background: st.bg, color: st.fg }}>{st.label}</span></span>
                    <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Menu width={230} items={[
                        { label: 'Marcar como pago', disabled: p.status === 'pago', onClick: () => setStatus(p.id, 'pago', `Parcela de ${p.resp} marcada como paga.`) },
                        { label: 'Cobrar por WhatsApp', disabled: p.status === 'pago', onClick: () => cobrar(p) },
                        { label: 'Copiar PIX copia e cola', disabled: p.status === 'pago', onClick: () => copiarPix(p) },
                        { label: 'Gerar recibo', disabled: p.status !== 'pago', onClick: () => setRecibo(p) },
                        { label: 'Reabrir', disabled: p.status !== 'pago', onClick: () => setStatus(p.id, 'aberto', 'Parcela reaberta.') },
                      ]} />
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>
            <div className="card" style={{ padding: '16px 18px' }}>
              <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 2 }}>Faturamento</div>
              <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#8b93a7', marginBottom: 14 }}>recebido · últimos 7 meses</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 160 }}>
                {chart.series.map((b, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 7, height: '100%' }} title={brMoney(b.val)}>
                    <div style={{ width: '100%', height: `${Math.max(3, (b.val / chart.max) * 140)}px`, borderRadius: '7px 7px 0 0', background: i === chart.series.length - 1 ? '#3f6bf5' : '#cdd8ff' }} />
                    <span style={{ font: "700 10px 'JetBrains Mono'", color: '#8b93a7' }}>{b.m}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: '16px 18px', flex: 1 }}>
              <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 12 }}>Contas a receber por status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {statusBreak.map((p) => (
                  <div key={p.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', font: "700 12px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 5 }}>
                      <span>{p.label}</span><span>{p.pct}%</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 6, background: '#eef1f1' }}><div style={{ width: `${p.pct}%`, height: '100%', borderRadius: 6, background: p.color }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Lançamentos manuais (receitas e despesas) */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid #eff2f8' }}>
            <div style={{ font: "800 15px 'Plus Jakarta Sans'", color: '#26324a' }}>Lançamentos (receitas e despesas)</div>
            <div style={{ display: 'flex', gap: 16, font: "700 12.5px 'Plus Jakarta Sans'" }}>
              <span style={{ color: '#2f9a5b' }}>Receitas {brMoney(totReceita)}</span>
              <span style={{ color: '#d64b45' }}>Despesas {brMoney(totDespesa)}</span>
              <span style={{ color: '#26324a' }}>Saldo {brMoney(totReceita - totDespesa)}</span>
            </div>
          </div>
          <div className="table-head" style={{ gridTemplateColumns: ENTRY_GRID, padding: '10px 20px' }}>
            <span>DESCRIÇÃO</span><span>CATEGORIA</span><span>DATA</span><span style={{ textAlign: 'right' }}>VALOR</span><span style={{ textAlign: 'right' }}>STATUS</span><span />
          </div>
          {fEntries.length === 0 ? (
            <EmptyState icon="dollar" title="Nenhum lançamento" desc={sel ? 'Nenhum lançamento neste período.' : 'Use + Receita ou − Despesa para lançar manualmente.'} />
          ) : fEntries.map((e) => (
            <div key={e.id} className="table-row" style={{ gridTemplateColumns: ENTRY_GRID, padding: '12px 20px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.type === 'receita' ? '#2f9a5b' : '#d64b45' }} />{e.description}
              </span>
              <span style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#5b647a' }}>{e.category}</span>
              <span className="tnum" style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>{e.date}</span>
              <span className="tnum" style={{ font: "700 13px 'Plus Jakarta Sans'", color: e.type === 'receita' ? '#2f9a5b' : '#d64b45', textAlign: 'right' }}>{e.type === 'receita' ? '+' : '−'} {brMoney(e.value)}</span>
              <span style={{ textAlign: 'right' }}><span className="pill" style={{ background: e.status === 'pago' ? '#e7f6ee' : '#eef1f4', color: e.status === 'pago' ? '#2f9a5b' : '#3f4b57' }}>{e.status === 'pago' ? 'Pago' : 'Em aberto'}</span></span>
              <span style={{ display: 'flex', justifyContent: 'flex-end' }}><Menu items={[{ label: 'Excluir', danger: true, onClick: () => removeEntry(e.id) }]} /></span>
            </div>
          ))}
        </div>
      </div>

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

      {/* Recibo imprimível */}
      <PrintDoc open={!!recibo} title="Recibo" onClose={() => setRecibo(null)}>
        {recibo && (
          <div style={{ font: "500 13px/1.8 'Plus Jakarta Sans'", color: '#1c2430' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ font: "800 18px 'Plus Jakarta Sans'" }}>{clinic.name}</div>
              <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#5b647a' }}>
                {clinic.cro}{clinic.cnpj ? ` · CNPJ ${clinic.cnpj}` : ''} · {clinic.address}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid #1c2430', borderBottom: '2px solid #1c2430', padding: '10px 2px', marginBottom: 24 }}>
              <span style={{ font: "800 16px 'Plus Jakarta Sans'", letterSpacing: 1 }}>RECIBO</span>
              <span className="tnum" style={{ font: "800 16px 'Plus Jakarta Sans'" }}>{brMoney(parseMoney(recibo.val))}</span>
            </div>
            <p style={{ margin: '0 0 18px' }}>
              Recebemos de <b>{recibo.resp}</b> a importância de <b>{brMoney(parseMoney(recibo.val))}</b>, referente a{' '}
              <b>{recibo.ref || 'serviços odontológicos'}</b>{recibo.venc ? ` (vencimento ${recibo.venc})` : ''}, pela qual damos plena e geral quitação.
            </p>
            <p style={{ margin: '0 0 48px' }}>
              {BRAND.city}, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
            </p>
            <div style={{ width: 280, margin: '0 auto', textAlign: 'center', borderTop: '1px solid #1c2430', paddingTop: 8 }}>
              <div style={{ font: "700 13px 'Plus Jakarta Sans'" }}>{BRAND.dentist}</div>
              <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>{BRAND.role}</div>
            </div>
          </div>
        )}
      </PrintDoc>
    </>
  )
}

function FinCard({ label, value, dot, sub, valueColor = '#26324a', subColor = '#5b647a', borderColor }: {
  label: string; value: string; dot: string; sub: string; valueColor?: string; subColor?: string; borderColor?: string
}) {
  return (
    <div className="card card-hover" style={{ padding: '17px 18px', borderColor }}>
      <div style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#8b93a7' }}>{label}</div>
      <div className="tnum" style={{ font: "800 26px 'Plus Jakarta Sans'", color: valueColor, margin: '7px 0 5px' }}><CountUp value={value} /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />
        <span style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: subColor }}>{sub}</span>
      </div>
    </div>
  )
}
