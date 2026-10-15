import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../icons'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { Field, TextInput, Select, FieldRow } from '../components/Field'
import { Menu, Dropdown } from '../components/Menu'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, SkeletonRows } from '../components/States'
import { useToast } from '../components/Toast'
import { useStore, patientPath } from '../store'
import { exportCsv } from '../lib/exportCsv'
import { TREAT_STATUS, PERFIL, ORIGENS, idadeLabel, fmtHour, type TreatStatus, type Patient, type Perfil } from '../data'
import { DateField } from '../components/DateField'
import { maskCpf, validCpf, maskPhone, validPhone } from '../lib/masks'
import { PatientPhoto } from '../components/PatientPhoto'
import { useMediaQuery } from '../lib/useTablet'
import { diasDeRetornoVencido } from '../lib/retornos'
import { todayISO, addDays, parseISO, parseBr, diffDays, brDate } from '../lib/dates'
import { findPatientForEvent, waLink, contactPhone } from '../lib/whats'
import { msgRetorno, msgAniversario } from '../lib/mensagens'

const AGE_OPTS = ['Todas as idades', '0–3 anos', '4–6 anos', '7–9 anos', '10+ anos']
const STATUS_OPTS = ['Todos os status', ...Object.values(TREAT_STATUS).map((s) => s.label)]
const TIPO_OPTS = ['Convênio e Particular', 'Particular', 'Convênio']
const WD_LOWER = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

type PerfilFiltro = 'todos' | Perfil
const PERFIS: { key: PerfilFiltro; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'pediatrico', label: 'Pediátrico' },
  { key: 'estetico', label: 'Estético' },
  { key: 'adulto', label: 'Adulto' },
]

/** Situação do tratamento como texto + cor (a cor nunca vem sozinha). */
const SITUACAO: Record<TreatStatus, string> = {
  tratamento: 'info',
  manutencao: 'ok',
  concluido: 'neutral',
  lead: 'warn',
  primeira: 'warn',
}

const EMPTY = {
  name: '', age: '', resp: '', tipo: 'Particular' as Patient['tipo'], status: 'lead' as TreatStatus, perfil: 'pediatrico' as Perfil,
  birthdate: '', sex: '', cpf: '', phone: '', respCpf: '', respPhone: '', prontuario: '', origem: '',
}

interface RespForm { name: string; rel: string; cpf: string; phone: string }
const EMPTY_RESP: RespForm = { name: '', rel: 'Mãe', cpf: '', phone: '' }

const ageYears = (age: string) => Number((age.match(/(\d+)\s*a/) || [])[1] ?? age) || 0
/** Busca sem acento e sem caixa: "jose" encontra "José". */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export default function Pacientes() {
  const navigate = useNavigate()
  const { patients, events, addPatient, updatePatient, deletePatient, carga } = useStore()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  // ?filtro=vencidos vem do atalho "Retornos vencidos" do menu lateral
  const [params, setParams] = useSearchParams()
  const onlyOverdue = params.get('filtro') === 'vencidos'
  const setOnlyOverdue = (fn: (v: boolean) => boolean) => {
    const next = new URLSearchParams(params)
    if (fn(onlyOverdue)) next.set('filtro', 'vencidos')
    else next.delete('filtro')
    setParams(next, { replace: true })
  }
  const [ageF, setAgeF] = useState(AGE_OPTS[0])
  const [statusF, setStatusF] = useState(STATUS_OPTS[0])
  const [tipoF, setTipoF] = useState(TIPO_OPTS[0])
  const [perfilF, setPerfilF] = useState<PerfilFiltro>('todos')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [resps, setResps] = useState<RespForm[]>([{ ...EMPTY_RESP }])
  const setResp = (i: number, patch: Partial<RespForm>) => setResps((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const [step, setStep] = useState(0)
  const openNovo = () => { setForm(EMPTY); setResps([{ ...EMPTY_RESP }]); setStep(0); setOpen(true) }
  // wizard: pediátrico tem etapa própria de responsáveis
  const stepsList = form.perfil === 'pediatrico' ? ['Dados do paciente', 'Responsáveis', 'Detalhes finais'] : ['Dados do paciente', 'Detalhes finais']
  const lastStep = stepsList.length - 1
  const avancar = () => {
    if (step === 0) {
      if (!form.name.trim()) return toast(form.perfil === 'pediatrico' ? 'Informe o nome da criança.' : 'Informe o nome do paciente.', 'error')
      if (!form.birthdate) return toast('Informe a data de nascimento.', 'error')
      if (!validCpf(form.cpf)) return toast('CPF inválido.', 'error')
      if (!validPhone(form.phone)) return toast('Telefone incompleto.', 'error')
    }
    if (form.perfil === 'pediatrico' && step === 1) {
      for (const r of resps.filter((x) => x.name.trim())) {
        if (!validCpf(r.cpf)) return toast(`CPF de ${r.name.trim()} inválido.`, 'error')
        if (!validPhone(r.phone)) return toast(`Telefone de ${r.name.trim()} incompleto.`, 'error')
      }
    }
    setStep(step + 1)
  }
  const [editing, setEditing] = useState<Patient | null>(null)
  // nome com que o paciente foi aberto para edição: o store localiza o registro por ele,
  // então renomear precisa usar o nome antigo (com o novo, nada era salvo)
  const [editingOrig, setEditingOrig] = useState('')
  const abrirEdicao = (p: Patient) => { setEditing(p); setEditingOrig(p.name) }
  const [confirmDel, setConfirmDel] = useState<Patient | null>(null)
  // esqueleto enquanto o banco carrega de verdade (antes era um atraso fixo de 450 ms)
  const loading = carga === 'carregando'

  const hoje = todayISO()
  const amanha = addDays(hoje, 1)
  const idadeDe = (p: Patient) => (p.birthdate ? idadeLabel(p.birthdate) : '') || p.age

  // próxima consulta marcada na agenda, por paciente
  const proximaConsulta = useMemo(() => {
    const m = new Map<string, { date: string; start: number }>()
    events.forEach((e) => {
      if (e.date < hoje || e.status === 'desmarcado' || e.status === 'faltou' || e.status === 'concluido') return
      const p = findPatientForEvent(patients, e)
      if (!p) return
      const atual = m.get(p.name)
      if (!atual || e.date < atual.date || (e.date === atual.date && e.start < atual.start)) m.set(p.name, { date: e.date, start: e.start })
    })
    return m
  }, [events, patients, hoje])

  const vencidosDias = useMemo(() => new Map(patients.map((p) => [p.name, diasDeRetornoVencido(p, hoje)])), [patients, hoje])
  const totalVencidos = [...vencidosDias.values()].filter((d) => d !== null).length

  const rows = useMemo(() => {
    const q = norm(query.trim())
    const lista = patients.filter((p) => {
      if (onlyOverdue && vencidosDias.get(p.name) == null) return false
      if (q && !(norm(p.name).includes(q) || norm(p.resp).includes(q) || (p.cpf ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, '') || '§'))) return false
      if (tipoF !== TIPO_OPTS[0] && p.tipo !== tipoF) return false
      if (perfilF !== 'todos' && (p.perfil ?? 'pediatrico') !== perfilF) return false
      if (statusF !== STATUS_OPTS[0] && TREAT_STATUS[p.status].label !== statusF) return false
      if (ageF !== AGE_OPTS[0]) {
        const y = ageYears(idadeDe(p))
        const ok = (ageF === '0–3 anos' && y <= 3) || (ageF === '4–6 anos' && y >= 4 && y <= 6) || (ageF === '7–9 anos' && y >= 7 && y <= 9) || (ageF === '10+ anos' && y >= 10)
        if (!ok) return false
      }
      return true
    })
    // urgência primeiro: retorno vencido há mais tempo, depois o próximo retorno mais perto
    const chave = (p: Patient) => {
      const dias = vencidosDias.get(p.name)
      if (dias != null) return -100000 - dias
      const iso = parseBr(p.next ?? '')
      return iso ? diffDays(hoje, iso) : 100000
    }
    return [...lista].sort((a, b) => chave(a) - chave(b) || a.name.localeCompare(b.name, 'pt-BR'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, onlyOverdue, ageF, statusF, tipoF, perfilF, patients, vencidosDias, hoje])

  const porPerfil = (k: Perfil) => patients.filter((p) => (p.perfil ?? 'pediatrico') === k).length
  const contagemPerfil = (k: PerfilFiltro) => (k === 'todos' ? patients.length : porPerfil(k))
  const emTratamento = patients.filter((p) => p.status === 'tratamento').length

  const aniversarios = useMemo(() => patients.flatMap((p) => {
    if (!p.birthdate) return []
    const b = parseISO(p.birthdate)
    if (Number.isNaN(b.getTime())) return []
    for (let i = 0; i < 7; i++) {
      const d = parseISO(addDays(hoje, i))
      if (d.getDate() === b.getDate() && d.getMonth() === b.getMonth()) {
        const anos = d.getFullYear() - b.getFullYear()
        const quando = i === 0 ? 'hoje' : i === 1 ? 'amanhã' : `${WD_LOWER[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
        return [{ p, quando, anos }]
      }
    }
    return []
  }), [patients, hoje])

  const abrirWhats = (p: Patient, msg: string) => {
    const link = waLink(contactPhone(p), msg)
    if (!link) return toast(`Sem telefone cadastrado para ${p.name}. Complete o cadastro.`, 'error')
    window.open(link, '_blank', 'noopener')
  }
  const abrirFicha = (p: Patient) => navigate(patientPath(p, 'odontograma'))

  const submit = async () => {
    if (!form.name.trim()) return toast(form.perfil === 'pediatrico' ? 'Informe o nome da criança.' : 'Informe o nome do paciente.', 'error')
    if (!form.birthdate) return toast('Informe a data de nascimento.', 'error')
    if (!validCpf(form.cpf)) return toast('CPF inválido.', 'error')
    if (!validPhone(form.phone)) return toast('Telefone incompleto.', 'error')
    const filled = form.perfil === 'pediatrico' ? resps.filter((r) => r.name.trim()) : []
    for (const r of filled) {
      if (!validCpf(r.cpf)) return toast(`CPF de ${r.name.trim()} inválido.`, 'error')
      if (!validPhone(r.phone)) return toast(`Telefone de ${r.name.trim()} incompleto.`, 'error')
    }
    const r0 = filled[0]
    if (saving) return
    setSaving(true)
    const novo = await addPatient({
        name: form.name.trim(), age: idadeLabel(form.birthdate) || '—',
        resp: r0 ? `${r0.name.trim()} · ${r0.rel.toLowerCase()}` : '—', last: '—', next: 'a agendar', tipo: form.tipo, status: form.status, perfil: form.perfil,
        birthdate: form.birthdate, sex: form.sex, cpf: form.cpf, phone: form.phone, respCpf: r0?.cpf ?? '', respPhone: r0?.phone ?? '', prontuario: form.prontuario, origem: form.origem,
      }, filled.map((r, i) => ({ name: r.name.trim(), rel: r.rel, phone: r.phone, cpf: r.cpf, main: i === 0 })))
    setSaving(false)
    if (!novo) return // o banco recusou: o aviso já apareceu e o formulário continua preenchido
    setOpen(false)
    setForm(EMPTY)
    setResps([{ ...EMPTY_RESP }])
    toast('Paciente cadastrado com sucesso.')
  }

  const saveEdit = async () => {
    if (!editing) return
    if (!editing.name.trim()) return toast('Informe o nome do paciente.', 'error')
    if (!validCpf(editing.cpf ?? '')) return toast('CPF inválido.', 'error')
    if (!validCpf(editing.respCpf ?? '')) return toast('CPF do responsável inválido.', 'error')
    if (!validPhone(editing.phone ?? '') || !validPhone(editing.respPhone ?? '')) return toast('Telefone incompleto.', 'error')
    const novoNome = editing.name.trim()
    if (novoNome !== editingOrig && patients.some((p) => p.name.toLowerCase() === novoNome.toLowerCase())) {
      return toast(`Já existe um paciente chamado ${novoNome}.`, 'error')
    }
    const alvo = patients.find((p) => p.name === editingOrig)
    if (!alvo) return
    setSaving(true)
    const ok = await updatePatient(alvo._id, { ...editing, name: novoNome })
    setSaving(false)
    if (!ok) return
    setEditing(null)
    toast('Paciente atualizado.')
  }

  const exportar = () => {
    const headers = ['Nome', 'Idade', 'Perfil', 'Responsável', 'Telefone', 'CPF', 'Convênio', 'Status', 'Última visita', 'Próximo retorno', 'Prontuário']
    const data = rows.map((p) => [p.name, idadeDe(p), PERFIL[p.perfil ?? 'pediatrico'].label, p.resp, p.phone ?? '', p.cpf ?? '', p.tipo, TREAT_STATUS[p.status].label, p.last, p.next, p.prontuario ?? ''])
    exportCsv('pacientes', headers, data)
    toast(`${rows.length} paciente${rows.length === 1 ? '' : 's'} exportado${rows.length === 1 ? '' : 's'}.`)
  }

  // celular: cartões em lista no lugar da tabela de 880 px
  const celular = useMediaQuery('(max-width: 640px)')
  /** Linha de situação do cartão no celular: o que importa primeiro sobre o retorno. */
  const linhaCelular = (p: Patient): { txt: string; danger?: boolean } => {
    const dias = vencidosDias.get(p.name)
    if (dias != null) return { txt: dias > 0 ? `Retorno vencido há ${plural(dias, 'dia', 'dias')}` : 'Retorno vencido', danger: true }
    const consulta = proximaConsulta.get(p.name)
    if (consulta) return { txt: `Próxima: ${consulta.date === hoje ? 'hoje' : consulta.date === amanha ? 'amanhã' : `${consulta.date.slice(8, 10)}/${consulta.date.slice(5, 7)}`}, ${fmtHour(consulta.start)}` }
    return { txt: parseBr(p.next ?? '') ? `Retorno em ${p.next}` : 'Retorno a definir' }
  }
  /** "Ana Paula · mãe" → "mãe: Ana Paula" (como no cartão do canvas). */
  const respCurto = (resp?: string) => {
    if (!resp || resp === '—') return ''
    const [nome, rel] = resp.split('·').map((x) => x.trim())
    return rel ? `${rel}: ${nome.split(' ')[0]}` : nome
  }

  /** Próximo retorno: data, quanto falta (ou há quanto venceu) e a próxima consulta já marcada. */
  const celulaRetorno = (p: Patient) => {
    const dias = vencidosDias.get(p.name)
    const iso = parseBr(p.next ?? '')
    const consulta = proximaConsulta.get(p.name)
    const consultaTxt = consulta ? `consulta ${consulta.date === hoje ? 'hoje' : consulta.date === amanha ? 'amanhã' : `em ${consulta.date.slice(8, 10)}/${consulta.date.slice(5, 7)}`} · ${fmtHour(consulta.start)}` : ''
    if (dias != null) {
      return (
        <>
          <span className="cell-main">{iso ? p.next : 'vencido'}</span>
          <span className="cell-sub danger">{dias > 0 ? `vencido há ${plural(dias, 'dia', 'dias')}` : 'retorno vencido'}</span>
          {consultaTxt && <span className="cell-sub info">{consultaTxt}</span>}
        </>
      )
    }
    if (iso) {
      const falta = diffDays(hoje, iso)
      return (
        <>
          <span className="cell-main">{p.next}</span>
          <span className={`cell-sub${consultaTxt || falta <= 7 ? ' info' : ''}`}>{consultaTxt || (falta === 0 ? 'hoje' : falta === 1 ? 'amanhã' : `em ${plural(falta, 'dia', 'dias')}`)}</span>
        </>
      )
    }
    return (
      <>
        <span className="cell-main muted">{p.next && p.next !== '—' ? p.next : 'a definir'}</span>
        {consultaTxt && <span className="cell-sub info">{consultaTxt}</span>}
      </>
    )
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Pacientes</h1>
          <p className="topbar-sub">
            {plural(patients.length, 'paciente', 'pacientes')} · {emTratamento} em tratamento
            {totalVencidos > 0 && ` · ${plural(totalVencidos, 'com retorno vencido', 'com retorno vencido')}`}
          </p>
        </div>
        <div className="topbar-actions">
          {!celular && <button className="btn-soft" style={{ height: 40, padding: '0 16px', borderRadius: 11 }} onClick={exportar}>Exportar CSV</button>}
          <button className="btn-cta" onClick={openNovo}><Icon name="plus" size={16} /> Novo paciente</button>
        </div>
      </header>

      <div className="page-body">
        <div className="home-cols">
          <section className="panel flush home-main" style={{ flexBasis: 860 }} aria-label="Lista de pacientes">
            <div className="list-toolbar">
              <label className="search-field">
                <Icon name="search" size={16} />
                <input placeholder="Nome, responsável ou CPF" aria-label="Buscar paciente" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <div className="seg-sm" role="group" aria-label="Perfil">
                {PERFIS.map((f) => (
                  <button key={f.key} aria-pressed={perfilF === f.key} onClick={() => setPerfilF(f.key)}>{f.label}<span className="n">{contagemPerfil(f.key)}</span></button>
                ))}
              </div>
              <button className="chip-toggle danger" aria-pressed={onlyOverdue} onClick={() => setOnlyOverdue((v) => !v)}>
                <Icon name="clock" size={15} /> Retorno vencido <b style={{ fontWeight: 600 }}>{totalVencidos}</b>
              </button>
            </div>
            <div className="list-toolbar" style={{ paddingTop: 0 }}>
              <Dropdown label="Faixa etária" value={ageF} options={AGE_OPTS} onChange={setAgeF} />
              <Dropdown label="Situação" value={statusF} options={STATUS_OPTS} onChange={setStatusF} />
              <Dropdown label="Cobertura" value={tipoF} options={TIPO_OPTS} onChange={setTipoF} />
            </div>

            {celular ? (
              <div className="pcards" aria-label="Pacientes">
                {loading && <SkeletonRows rows={6} />}
                {!loading && rows.map((p) => {
                  const vencido = vencidosDias.get(p.name) != null
                  const perfil = p.perfil ?? 'pediatrico'
                  const idade = idadeDe(p)
                  const st = linhaCelular(p)
                  return (
                    <button key={p.name} className={`pcard${vencido ? ' hot' : ''}`} onClick={() => abrirFicha(p)}>
                      <span className={`p-avatar${vencido ? ' hot' : perfil === 'estetico' ? ' est' : ''}`}>
                        <PatientPhoto src={p.photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} fallback={p.initials} />
                      </span>
                      <span className="pcard-main">
                        <span className="pcard-name">{p.name}</span>
                        <span className="pcard-sub">{[idade && idade !== '—' ? idade : '', respCurto(p.resp) || PERFIL[perfil].label.toLowerCase()].filter(Boolean).join(' · ')}</span>
                        <span className={`pcard-st${st.danger ? ' danger' : ''}`}>{st.txt}</span>
                      </span>
                      <span className="chev-right" aria-hidden="true"><Icon name="chevron" size={17} /></span>
                    </button>
                  )
                })}
                {!loading && rows.length === 0 && <EmptyState icon="users" title="Nenhum paciente encontrado" desc="Ajuste a busca e os filtros ou cadastre um novo paciente." action={<Button icon={<Icon name="plus" size={17} />} onClick={openNovo}>Novo paciente</Button>} />}
              </div>
            ) : (
            <div className="ptable">
              <div className="ptable-inner" role="table" aria-label="Pacientes">
                <div className="prow head" role="row">
                  <span role="columnheader">Paciente</span><span role="columnheader">Situação</span><span role="columnheader">Próximo retorno</span>
                  <span role="columnheader">Última visita</span><span role="columnheader">Responsável</span><span role="columnheader"><span className="visually-hidden">Ações</span></span>
                </div>
                {loading && <SkeletonRows rows={6} />}
                {!loading && rows.map((p) => {
                  const dias = vencidosDias.get(p.name)
                  const vencido = dias != null
                  const perfil = p.perfil ?? 'pediatrico'
                  const idade = idadeDe(p)
                  return (
                    <div key={p.name} role="row" className={`prow clickable${vencido ? ' hot' : ''}`} onClick={() => abrirFicha(p)}>
                      <span className="q-person" role="cell">
                        <span className={`p-avatar${vencido ? ' hot' : perfil === 'estetico' ? ' est' : ''}`}>
                          <PatientPhoto src={p.photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} fallback={p.initials} />
                        </span>
                        <span className="q-text">
                          <span className="q-main">{p.name}</span>
                          <span className="q-sub">{[idade && idade !== '—' ? idade : '', PERFIL[perfil].label.toLowerCase(), p.prontuario ? `pront. ${p.prontuario.replace(/^#/, '')}` : ''].filter(Boolean).join(' · ')}</span>
                        </span>
                      </span>
                      <span role="cell">
                        {vencido
                          ? <span className="q-reason danger">Retorno vencido</span>
                          : <span className={`q-reason ${SITUACAO[p.status]}`}>{TREAT_STATUS[p.status].label}</span>}
                      </span>
                      <span className="q-text" role="cell">{celulaRetorno(p)}</span>
                      <span className="q-text" role="cell">
                        <span className={`cell-main${!p.last || p.last === '—' ? ' muted' : ''}`}>{p.last && p.last !== '—' ? p.last : 'nenhuma'}</span>
                        <span className="cell-sub">{p.tipo}</span>
                      </span>
                      <span className="q-text" role="cell">
                        <span className="cell-main" style={{ fontWeight: 400, color: p.resp && p.resp !== '—' ? 'var(--slate)' : 'var(--muted)' }}>{p.resp && p.resp !== '—' ? p.resp : 'o próprio paciente'}</span>
                      </span>
                      <span className="row-actions" role="cell" onClick={(e) => e.stopPropagation()}>
                        {vencido
                          ? <button className="btn-line danger" onClick={() => abrirWhats(p, msgRetorno(p))}>Chamar</button>
                          : <button className="btn-line" onClick={() => navigate('/agenda')}>Agendar</button>}
                        <Menu items={[
                          { label: 'Abrir ficha', onClick: () => abrirFicha(p) },
                          { label: 'Editar cadastro', onClick: () => abrirEdicao(p) },
                          { label: 'Chamar no WhatsApp', onClick: () => abrirWhats(p, msgRetorno(p)) },
                          { label: 'Excluir', danger: true, onClick: () => setConfirmDel(p) },
                        ]} />
                      </span>
                    </div>
                  )
                })}
                {!loading && rows.length === 0 && <EmptyState icon="users" title="Nenhum paciente encontrado" desc="Ajuste a busca e os filtros ou cadastre um novo paciente." action={<Button icon={<Icon name="plus" size={17} />} onClick={openNovo}>Novo paciente</Button>} />}
              </div>
            </div>
            )}
            <div className="list-foot">
              <span>Mostrando <b style={{ fontWeight: 600, color: 'var(--ink)' }}>{rows.length} de {patients.length}</b> · urgentes primeiro</span>
              {(query || onlyOverdue || perfilF !== 'todos' || ageF !== AGE_OPTS[0] || statusF !== STATUS_OPTS[0] || tipoF !== TIPO_OPTS[0]) && (
                <button className="panel-link" onClick={() => { setQuery(''); setPerfilF('todos'); setAgeF(AGE_OPTS[0]); setStatusF(STATUS_OPTS[0]); setTipoF(TIPO_OPTS[0]); if (onlyOverdue) setOnlyOverdue(() => false) }}>Limpar filtros</button>
              )}
            </div>
          </section>

          <aside className="home-aside wrap-row" aria-label="Resumo dos pacientes">
            <section className="panel">
              <h2 className="panel-title sm">Por perfil</h2>
              <div className="hbars">
                {([['pediatrico', 'var(--primary)'], ['estetico', 'var(--brand-pink)'], ['adulto', 'var(--slate)']] as [Perfil, string][]).map(([k, cor]) => (
                  <button key={k} onClick={() => setPerfilF(k)} style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }} aria-label={`Filtrar ${PERFIL[k].label}: ${porPerfil(k)}`}>
                    <div className="hbar-top"><span>{PERFIL[k].label}</span><span>{porPerfil(k)}</span></div>
                    <div className="hbar-track"><div className="hbar-fill" style={{ width: `${patients.length ? (porPerfil(k) / patients.length) * 100 : 0}%`, background: cor }} /></div>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel">
              <h2 className="panel-title sm">Aniversariantes da semana</h2>
              {aniversarios.length === 0 ? (
                <p className="empty-note">Nenhum aniversário nos próximos 7 dias.</p>
              ) : (
                <div className="list-rows">
                  {aniversarios.map(({ p, quando, anos }) => (
                    <div key={p.name} className="list-row">
                      <span className="p-avatar" style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>{p.initials}</span>
                      <span className="q-text" style={{ flex: 1 }}>
                        <span className="q-main">{p.name}</span>
                        <span className="q-sub">{quando} · {plural(anos, 'ano', 'anos')}</span>
                      </span>
                      <button className="panel-link" onClick={() => abrirWhats(p, msgAniversario(p))}>Parabenizar</button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="note-panel">
              <b>Idade e retorno vencido são calculados</b> a partir da data de nascimento e do próximo retorno, todo dia. Nada fica congelado no cadastro.
            </div>
          </aside>
        </div>
      </div>

      {/* Novo paciente — wizard em etapas */}
      <Modal open={open} onClose={() => setOpen(false)} title="Novo paciente" subtitle={`Etapa ${step + 1} de ${stepsList.length} · ${stepsList[step]}`}
        dirty={JSON.stringify(form) !== JSON.stringify(EMPTY) || resps.some((r) => r.name.trim() || r.cpf || r.phone)}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <span style={{ flex: 1 }} />
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>Voltar</Button>}
          {step < lastStep
            ? <Button onClick={avancar}>Avançar</Button>
            : <Button loading={saving} onClick={submit}>Salvar paciente</Button>}
        </>}>
        {/* progresso */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
          {stepsList.map((s, i) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= step ? 'var(--primary)' : 'var(--line)', transition: 'background .2s ease' }} title={s} />
          ))}
        </div>

        {step === 0 && (
          <>
            <Field label="Perfil do paciente"><Select value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value as Perfil })}><option value="pediatrico">Pediátrico (criança + responsável)</option><option value="estetico">Estético (harmonização)</option><option value="adulto">Adulto (odontologia)</option></Select></Field>
            <Field label={form.perfil === 'pediatrico' ? 'Nome da criança' : 'Nome do paciente'}><TextInput autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Sofia Ribeiro Martins" /></Field>
            <FieldRow>
              <Field label="Data de nascimento *"><DateField value={form.birthdate} onChange={(iso) => setForm({ ...form, birthdate: iso, age: idadeLabel(iso) || form.age })} /></Field>
              <Field label="Idade (calculada)"><TextInput value={form.birthdate ? idadeLabel(form.birthdate) : ''} readOnly placeholder="—" /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Sexo"><Select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}><option value="">—</option><option>Feminino</option><option>Masculino</option></Select></Field>
              <Field label="Tipo"><Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Patient['tipo'] })}><option>Particular</option><option>Convênio</option></Select></Field>
            </FieldRow>
            <FieldRow>
              <Field label="CPF"><TextInput inputMode="numeric" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" /></Field>
              <Field label="Telefone"><TextInput inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} placeholder="(45) 90000-0000" /></Field>
            </FieldRow>
          </>
        )}

        {form.perfil === 'pediatrico' && step === 1 && (
          <>
            {resps.map((r, i) => (
              <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FieldRow>
                  <Field label={i === 0 ? 'Nome (principal)' : 'Nome'}><TextInput autoFocus={i === 0} value={r.name} onChange={(e) => setResp(i, { name: e.target.value })} placeholder="Ex.: Ana Paula" /></Field>
                  <Field label="Parentesco"><Select value={r.rel} onChange={(e) => setResp(i, { rel: e.target.value })}><option>Mãe</option><option>Pai</option><option>Avó/Avô</option><option>Responsável legal</option></Select></Field>
                </FieldRow>
                <FieldRow>
                  <Field label="CPF"><TextInput inputMode="numeric" value={r.cpf} onChange={(e) => setResp(i, { cpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" /></Field>
                  <Field label="Telefone"><TextInput inputMode="tel" value={r.phone} onChange={(e) => setResp(i, { phone: maskPhone(e.target.value) })} placeholder="(45) 90000-0000" /></Field>
                </FieldRow>
                {i > 0 && (
                  <button onClick={() => setResps((prev) => prev.filter((_, j) => j !== i))}
                    style={{ alignSelf: 'flex-end', border: 'none', background: 'transparent', font: "700 11.5px var(--font)", color: 'var(--danger-text)', cursor: 'pointer', padding: '2px 4px' }}>
                    Remover responsável
                  </button>
                )}
              </div>
            ))}
            <Button size="sm" variant="outline" onClick={() => setResps((prev) => [...prev, { ...EMPTY_RESP, rel: 'Pai' }])}>+ Adicionar outro responsável</Button>
          </>
        )}

        {step === lastStep && (
          <>
            <FieldRow>
              <Field label="Prontuário"><TextInput autoFocus value={form.prontuario} onChange={(e) => setForm({ ...form, prontuario: e.target.value })} placeholder="#0428" /></Field>
              <Field label="Status do tratamento"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TreatStatus })}>{Object.entries(TREAT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
            </FieldRow>
            <Field label="Como conheceu a clínica"><Select value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })}><option value="">—</option>{ORIGENS.map((o) => <option key={o} value={o}>{o}</option>)}</Select></Field>
            <div style={{ padding: '11px 14px', borderRadius: 10, background: 'var(--bg-soft)', border: '1px solid var(--line)', font: "600 12px/1.6 var(--font)", color: 'var(--slate)' }}>
              <b style={{ color: 'var(--ink)' }}>{form.name || '—'}</b> · {form.perfil === 'pediatrico' ? 'Pediátrico' : form.perfil === 'estetico' ? 'Estético' : 'Adulto'} · {form.tipo}
              {form.birthdate ? ` · ${idadeLabel(form.birthdate)}` : ''}
              {form.perfil === 'pediatrico' && resps[0]?.name.trim() ? ` · Resp.: ${resps[0].name.trim()}` : ''}
            </div>
          </>
        )}
      </Modal>

      {/* Editar paciente */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar paciente" subtitle={editing?.name}
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={saveEdit}>Salvar</Button></>}>
        {editing && (
          <>
            <FieldRow>
              <Field label="Nome"><TextInput value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Perfil"><Select value={editing.perfil ?? 'pediatrico'} onChange={(e) => setEditing({ ...editing, perfil: e.target.value as Perfil })}><option value="pediatrico">Pediátrico</option><option value="estetico">Estético</option><option value="adulto">Adulto</option></Select></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Data de nascimento"><DateField value={editing.birthdate ?? ''} onChange={(iso) => setEditing({ ...editing, birthdate: iso, age: idadeLabel(iso) || editing.age })} /></Field>
              <Field label={`Idade${editing.birthdate ? ' (calculada)' : ''}`}><TextInput value={editing.birthdate ? idadeLabel(editing.birthdate) : editing.age} readOnly={!!editing.birthdate} onChange={(e) => setEditing({ ...editing, age: e.target.value })} /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Sexo"><Select value={editing.sex ?? ''} onChange={(e) => setEditing({ ...editing, sex: e.target.value })}><option value="">—</option><option>Feminino</option><option>Masculino</option></Select></Field>
              <Field label="Tipo"><Select value={editing.tipo} onChange={(e) => setEditing({ ...editing, tipo: e.target.value as Patient['tipo'] })}><option>Particular</option><option>Convênio</option></Select></Field>
            </FieldRow>
            <FieldRow>
              <Field label="CPF"><TextInput inputMode="numeric" value={editing.cpf ?? ''} onChange={(e) => setEditing({ ...editing, cpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" /></Field>
              <Field label="Telefone"><TextInput inputMode="tel" value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: maskPhone(e.target.value) })} placeholder="(45) 90000-0000" /></Field>
            </FieldRow>
            {(editing.perfil ?? 'pediatrico') === 'pediatrico' && (
              <>
                <Field label="Responsável principal"><TextInput value={editing.resp} onChange={(e) => setEditing({ ...editing, resp: e.target.value })} /></Field>
                <FieldRow>
                  <Field label="CPF do responsável"><TextInput inputMode="numeric" value={editing.respCpf ?? ''} onChange={(e) => setEditing({ ...editing, respCpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" /></Field>
                  <Field label="Telefone do responsável"><TextInput inputMode="tel" value={editing.respPhone ?? ''} onChange={(e) => setEditing({ ...editing, respPhone: maskPhone(e.target.value) })} placeholder="(45) 90000-0000" /></Field>
                </FieldRow>
              </>
            )}
            <FieldRow>
              <Field label="Próximo retorno"><DateField value={parseBr(editing.next ?? '') ?? ''} onChange={(iso) => setEditing({ ...editing, next: iso ? brDate(iso) : 'a agendar' })} /></Field>
              <Field label="Status"><Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as TreatStatus })}>{Object.entries(TREAT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
            </FieldRow>
          </>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={async () => { if (!confirmDel) return; const alvo = patients.find((p) => p.name === confirmDel.name); if (alvo && await deletePatient(alvo._id)) toast('Paciente excluído.') }}
        title="Excluir paciente" message={`Excluir ${confirmDel?.name ?? ''}? Todos os dados da ficha serão removidos.`} />
    </>
  )
}
