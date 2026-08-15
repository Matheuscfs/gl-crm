import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../icons'
import { Pill } from '../components/ui'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { Field, TextInput, Select, FieldRow } from '../components/Field'
import { Menu, Dropdown } from '../components/Menu'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, SkeletonRows } from '../components/States'
import { useToast } from '../components/Toast'
import { useStore } from '../store'
import { exportCsv } from '../lib/exportCsv'
import { TREAT_STATUS, PERFIL, ORIGENS, idadeLabel, type TreatStatus, type Patient, type Perfil } from '../data'
import { DateField } from '../components/DateField'
import { maskCpf, validCpf, maskPhone, validPhone } from '../lib/masks'

const GRID = '2.4fr 0.7fr 1.5fr 1fr 1.1fr 0.85fr 1.1fr'
const AGE_OPTS = ['Todas as idades', '0–3 anos', '4–6 anos', '7–9 anos', '10+ anos']
const STATUS_OPTS = ['Todos os status', ...Object.values(TREAT_STATUS).map((s) => s.label)]
const TIPO_OPTS = ['Convênio e Particular', 'Particular', 'Convênio']
const PERFIL_OPTS = ['Todos os perfis', 'Pediátrico', 'Estético', 'Adulto']

const EMPTY = {
  name: '', age: '', resp: '', tipo: 'Particular' as Patient['tipo'], status: 'lead' as TreatStatus, perfil: 'pediatrico' as Perfil,
  birthdate: '', sex: '', cpf: '', phone: '', respCpf: '', respPhone: '', prontuario: '', origem: '',
}

interface RespForm { name: string; rel: string; cpf: string; phone: string }
const EMPTY_RESP: RespForm = { name: '', rel: 'Mãe', cpf: '', phone: '' }

const ageYears = (age: string) => Number((age.match(/(\d+)\s*a/) || [])[1] ?? age) || 0

export default function Pacientes() {
  const navigate = useNavigate()
  const { patients, addPatient, updatePatient, deletePatient } = useStore()
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [onlyOverdue, setOnlyOverdue] = useState(false)
  const [ageF, setAgeF] = useState(AGE_OPTS[0])
  const [statusF, setStatusF] = useState(STATUS_OPTS[0])
  const [tipoF, setTipoF] = useState(TIPO_OPTS[0])
  const [perfilF, setPerfilF] = useState(PERFIL_OPTS[0])
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
  const [confirmDel, setConfirmDel] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 450)
    return () => clearTimeout(t)
  }, [])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return patients.filter((p) => {
      if (onlyOverdue && !p.late) return false
      if (q && !(p.name.toLowerCase().includes(q) || p.resp.toLowerCase().includes(q))) return false
      if (tipoF !== TIPO_OPTS[0] && p.tipo !== tipoF) return false
      if (perfilF !== PERFIL_OPTS[0] && PERFIL[p.perfil ?? 'pediatrico'].label !== perfilF) return false
      if (statusF !== STATUS_OPTS[0] && TREAT_STATUS[p.status].label !== statusF) return false
      if (ageF !== AGE_OPTS[0]) {
        const y = ageYears(p.age)
        const ok = (ageF === '0–3 anos' && y <= 3) || (ageF === '4–6 anos' && y >= 4 && y <= 6) || (ageF === '7–9 anos' && y >= 7 && y <= 9) || (ageF === '10+ anos' && y >= 10)
        if (!ok) return false
      }
      return true
    })
  }, [query, onlyOverdue, ageF, statusF, tipoF, perfilF, patients])

  const submit = () => {
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
    setSaving(true)
    setTimeout(() => {
      addPatient({
        name: form.name.trim(), age: idadeLabel(form.birthdate) || '—',
        resp: r0 ? `${r0.name.trim()} · ${r0.rel.toLowerCase()}` : '—', last: '—', next: 'a agendar', tipo: form.tipo, status: form.status, perfil: form.perfil,
        birthdate: form.birthdate, sex: form.sex, cpf: form.cpf, phone: form.phone, respCpf: r0?.cpf ?? '', respPhone: r0?.phone ?? '', prontuario: form.prontuario, origem: form.origem,
      }, filled.map((r, i) => ({ name: r.name.trim(), rel: r.rel, phone: r.phone, cpf: r.cpf, main: i === 0 })))
      setSaving(false)
      setOpen(false)
      setForm(EMPTY)
      setResps([{ ...EMPTY_RESP }])
      toast('Paciente cadastrado com sucesso.')
    }, 400)
  }

  const saveEdit = () => {
    if (!editing) return
    if (!validCpf(editing.cpf ?? '')) return toast('CPF inválido.', 'error')
    if (!validCpf(editing.respCpf ?? '')) return toast('CPF do responsável inválido.', 'error')
    if (!validPhone(editing.phone ?? '') || !validPhone(editing.respPhone ?? '')) return toast('Telefone incompleto.', 'error')
    updatePatient(editing.name, editing)
    setEditing(null)
    toast('Paciente atualizado.')
  }

  const exportar = () => {
    const headers = ['Nome', 'Idade', 'Perfil', 'Responsável', 'Telefone', 'CPF', 'Convênio', 'Status', 'Última visita', 'Próximo retorno', 'Prontuário']
    const data = rows.map((p) => [p.name, p.age, PERFIL[p.perfil ?? 'pediatrico'].label, p.resp, p.phone ?? '', p.cpf ?? '', p.tipo, TREAT_STATUS[p.status].label, p.last, p.next, p.prontuario ?? ''])
    exportCsv('pacientes', headers, data)
    toast(`${rows.length} paciente${rows.length === 1 ? '' : 's'} exportado${rows.length === 1 ? '' : 's'}.`)
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">Pacientes</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label className="searchbox" style={{ width: 320 }}>
            <Icon name="search" size={18} />
            <input placeholder="Buscar criança ou responsável…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <Button variant="outline" onClick={exportar}>Exportar</Button>
          <Button icon={<Icon name="plus" size={17} />} onClick={openNovo}>Novo paciente</Button>
        </div>
      </header>

      <div style={{ height: 56, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', borderBottom: '1px solid #eff2f9', background: '#fafbff' }}>
        <div style={{ display: 'flex', gap: 9 }}>
          <Dropdown label="Perfil" value={perfilF} options={PERFIL_OPTS} onChange={setPerfilF} />
          <Dropdown label="Faixa etária" value={ageF} options={AGE_OPTS} onChange={setAgeF} />
          <Dropdown label="Status do tratamento" value={statusF} options={STATUS_OPTS} onChange={setStatusF} />
          <Dropdown label="Convênio / Particular" value={tipoF} options={TIPO_OPTS} onChange={setTipoF} />
          <button onClick={() => setOnlyOverdue((v) => !v)} className="chip"
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 13px', borderRadius: 9, font: "700 12.5px 'Plus Jakarta Sans'", ...(onlyOverdue ? { border: '1px solid #cdd8ff', background: '#e9eeff', color: '#2f52e0' } : { border: '1px solid #d7ddea', background: '#fff', color: '#5b647a' }) }}>
            Retorno vencido {onlyOverdue ? '✕' : ''}
          </button>
        </div>
        <span style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>
          {patients.length} pacientes · <b style={{ color: '#26324a' }}>mostrando {rows.length}</b>
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 28px 24px' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-head" style={{ gridTemplateColumns: GRID }}>
            <span>CRIANÇA</span><span>IDADE</span><span>RESPONSÁVEL PRINCIPAL</span><span>ÚLTIMA VISITA</span><span>PRÓXIMO RETORNO</span><span>TIPO</span><span>TRATAMENTO</span>
          </div>
          {loading && <SkeletonRows rows={6} />}
          {!loading && rows.map((p) => {
            const ts = TREAT_STATUS[p.status]
            return (
              <div key={p.name} className="table-row clickable" style={{ gridTemplateColumns: GRID }} onClick={() => navigate(`/pacientes/${encodeURIComponent(p.name)}/odontograma`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <div className="avatar" style={{ width: 36, height: 36, overflow: 'hidden' }}>
                    {p.photoUrl ? <img src={p.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.initials}
                  </div>
                  <span style={{ font: "700 13px 'Plus Jakarta Sans'", color: '#26324a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  <span className="pill" style={{ flex: 'none', padding: '2px 8px', background: PERFIL[p.perfil ?? 'pediatrico'].bg, color: PERFIL[p.perfil ?? 'pediatrico'].fg }}>{PERFIL[p.perfil ?? 'pediatrico'].short}</span>
                </div>
                <span className="tnum" style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{p.age}</span>
                <span style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#5b647a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.resp}</span>
                <span className="tnum" style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>{p.last}</span>
                <span className="tnum" style={{ font: `${p.late ? 700 : 600} 12.5px 'Plus Jakarta Sans'`, color: p.late ? '#a81e1e' : '#26324a' }}>{p.next}</span>
                <span><Pill bg={p.tipo === 'Convênio' ? '#eef4fb' : '#f0f2f4'} fg={p.tipo === 'Convênio' ? '#1d4ed8' : '#5b647a'}>{p.tipo}</Pill></span>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <Pill bg={ts.bg} fg={ts.fg}>{ts.label}</Pill>
                  <Menu items={[
                    { label: 'Abrir ficha', onClick: () => navigate(`/pacientes/${encodeURIComponent(p.name)}/odontograma`) },
                    { label: 'Editar', onClick: () => setEditing(p) },
                    { label: 'Agendar', onClick: () => navigate('/agenda') },
                    { label: 'Excluir', danger: true, onClick: () => setConfirmDel(p) },
                  ]} />
                </span>
              </div>
            )
          })}
          {!loading && rows.length === 0 && <EmptyState icon="users" title="Nenhum paciente encontrado" desc="Ajuste os filtros ou cadastre um novo paciente." action={<Button icon={<Icon name="plus" size={17} />} onClick={openNovo}>Novo paciente</Button>} />}
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
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= step ? '#3f6bf5' : '#e5eaf3', transition: 'background .2s ease' }} title={s} />
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
              <div key={i} style={{ border: '1px solid #eceff6', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                    style={{ alignSelf: 'flex-end', border: 'none', background: 'transparent', font: "700 11.5px 'Plus Jakarta Sans'", color: '#a81e1e', cursor: 'pointer', padding: '2px 4px' }}>
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
            <div style={{ padding: '11px 14px', borderRadius: 10, background: '#f4f6fb', border: '1px solid #e5eaf3', font: "600 12px/1.6 'Plus Jakarta Sans'", color: '#5b647a' }}>
              <b style={{ color: '#26324a' }}>{form.name || '—'}</b> · {form.perfil === 'pediatrico' ? 'Pediátrico' : form.perfil === 'estetico' ? 'Estético' : 'Adulto'} · {form.tipo}
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
              <Field label="Próximo retorno"><TextInput value={editing.next} onChange={(e) => setEditing({ ...editing, next: e.target.value })} /></Field>
              <Field label="Status"><Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as TreatStatus })}>{Object.entries(TREAT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
            </FieldRow>
          </>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={() => { if (confirmDel) { deletePatient(confirmDel.name); toast('Paciente excluído.') } }}
        title="Excluir paciente" message={`Excluir ${confirmDel?.name ?? ''}? Todos os dados da ficha serão removidos.`} />
    </>
  )
}
