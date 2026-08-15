import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Field, TextInput, FieldRow, Select } from '../../components/Field'
import { Menu } from '../../components/Menu'
import { useToast } from '../../components/Toast'
import { useCollection, usePatientId } from '../../lib/useCollection'
import { useStore } from '../../store'
import { idadeLabel, TREAT_STATUS, ORIGENS, type Patient, type Perfil, type TreatStatus } from '../../data'
import { DateField } from '../../components/DateField'
import { maskCpf, validCpf, maskPhone, validPhone } from '../../lib/masks'

const brDate = (iso?: string) => {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

interface Responsavel {
  id: string
  name: string
  rel: string
  phone: string
  cpf: string
  main: boolean
}

export default function Dados() {
  const { toast } = useToast()
  const patientId = usePatientId()
  const { patients, updatePatient } = useStore()
  const { id } = useParams()
  const p = patients.find((x) => x.name === (id ? decodeURIComponent(id) : ''))
  const est = (p?.perfil ?? 'pediatrico') !== 'pediatrico' // adulto e estético: paciente sem responsável
  const [editP, setEditP] = useState<Patient | null>(null)
  const saveCadastro = () => {
    if (!editP || !p) return
    if (!validCpf(editP.cpf ?? '') || !validCpf(editP.respCpf ?? '')) return toast('CPF inválido.', 'error')
    if (!validPhone(editP.phone ?? '') || !validPhone(editP.respPhone ?? '')) return toast('Telefone incompleto.', 'error')
    updatePatient(p.name, editP)
    setEditP(null)
    toast('Cadastro atualizado.')
  }
  const DADOS: [string, string][] = [
    ['Nome completo', p?.name ?? '—'],
    ['Data de nascimento', brDate(p?.birthdate)],
    ['Idade', p?.age ?? '—'],
    ['Sexo', p?.sex || '—'],
    ['Convênio', p?.tipo ?? '—'],
    ['Prontuário', p?.prontuario || '—'],
    ['CPF', p?.cpf || '—'],
    ['Telefone', p?.phone || '—'],
    ['Como conheceu', p?.origem || '—'],
  ]
  // responsável principal semeado a partir do cadastro do paciente
  const seedResp: Responsavel[] = p && !est
    ? [{ id: 'seed-main', name: (p.resp || '').split('·')[0].trim() || 'Responsável', rel: (p.resp || '').split('·')[1]?.trim() || 'Responsável', phone: p.respPhone ?? '', cpf: p.respCpf ?? '', main: true }]
    : []
  const { rows: resp, setRows, add, save, remove } = useCollection<Responsavel>(
    'responsaveis',
    patientId,
    (r) => ({ id: r.id as string, name: r.name as string, rel: (r.rel as string) ?? '', phone: (r.phone as string) ?? '', cpf: (r.cpf as string) ?? '', main: Boolean(r.is_main) }),
    (item) => ({ name: item.name, rel: item.rel, phone: item.phone, cpf: item.cpf, is_main: item.main }),
    seedResp,
    true, // sem linhas no banco, mostra o responsável do próprio cadastro
  )
  const [edit, setEdit] = useState<Responsavel | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<Omit<Responsavel, 'id'>>({ name: '', rel: 'Mãe', phone: '', cpf: '', main: false })

  const makeMain = (id: string) => {
    const next = resp.map((r) => ({ ...r, main: r.id === id }))
    setRows(next)
    next.forEach((r, i) => { if (r.main !== resp[i]?.main) save(r) })
    toast('Responsável principal atualizado.')
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignContent: 'start' }}>
      <div className="card card-hover" style={{ padding: '18px 20px' }}>
        <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 8 }}>{est ? 'Dados do paciente' : 'Dados da criança'}</div>
        {DADOS.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '11px 0', borderBottom: '1px solid #f2f5fb' }}>
            <span style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#8b93a7' }}>{k}</span>
            <span style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a', textAlign: 'right' }}>{v}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Button size="sm" variant="teal-soft" disabled={!p} onClick={() => p && setEditP({ ...p })}>Editar dados</Button>
        </div>
      </div>

      {!est && <div className="card card-hover" style={{ padding: '18px 20px', alignSelf: 'start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a' }}>Responsáveis</span>
          <Button size="sm" onClick={() => { setForm({ name: '', rel: 'Mãe', phone: '', cpf: '', main: false }); setAdding(true) }}>+ Adicionar</Button>
        </div>
        {resp.map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid #f2f5fb' }}>
            <div className="avatar" style={{ width: 38, height: 38 }}>{r.name.split(' ').map((s) => s[0]).slice(0, 2).join('')}</div>
            <div style={{ flex: 1 }}>
              <div style={{ font: "700 13px 'Plus Jakarta Sans'", color: '#26324a' }}>{r.name} {r.main && <span style={{ font: "700 10px 'Plus Jakarta Sans'", color: '#2f52e0', background: '#e9eeff', padding: '2px 7px', borderRadius: 12, marginLeft: 4 }}>principal</span>}</div>
              <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#8b93a7' }}>{r.rel}{r.phone ? ` · ${r.phone}` : ''}{r.cpf ? ` · CPF ${r.cpf}` : ''}</div>
            </div>
            <Menu items={[
              { label: 'Editar', onClick: () => setEdit(r) },
              { label: 'Tornar principal', disabled: r.main, onClick: () => makeMain(r.id) },
              { label: 'Remover', danger: true, disabled: r.main, onClick: () => { remove(r.id); toast('Responsável removido.') } },
            ]} />
          </div>
        ))}
      </div>}

      <Modal open={adding} onClose={() => setAdding(false)} title="Adicionar responsável" width={420}
        footer={<><Button variant="outline" onClick={() => setAdding(false)}>Cancelar</Button><Button onClick={() => { if (!form.name.trim()) return toast('Informe o nome.', 'error'); if (!validCpf(form.cpf)) return toast('CPF inválido.', 'error'); if (!validPhone(form.phone)) return toast('Telefone incompleto.', 'error'); add(form); setAdding(false); toast('Responsável adicionado.') }}>Adicionar</Button></>}>
        <Field label="Nome"><TextInput autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <FieldRow>
          <Field label="Parentesco"><Select value={form.rel} onChange={(e) => setForm({ ...form, rel: e.target.value })}><option>Mãe</option><option>Pai</option><option>Avó/Avô</option><option>Responsável legal</option></Select></Field>
          <Field label="Telefone"><TextInput inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} placeholder="(45) 90000-0000" /></Field>
        </FieldRow>
        <Field label="CPF"><TextInput inputMode="numeric" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" /></Field>
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Editar responsável" width={420}
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={() => { if (!edit) return; if (!validCpf(edit.cpf)) return toast('CPF inválido.', 'error'); if (!validPhone(edit.phone)) return toast('Telefone incompleto.', 'error'); save(edit); setEdit(null); toast('Responsável atualizado.') }}>Salvar</Button></>}>
        {edit && (
          <>
            <Field label="Nome"><TextInput value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <FieldRow>
              <Field label="Parentesco"><Select value={edit.rel} onChange={(e) => setEdit({ ...edit, rel: e.target.value })}><option>Mãe</option><option>Pai</option><option>Avó/Avô</option><option>Responsável legal</option></Select></Field>
              <Field label="Telefone"><TextInput inputMode="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: maskPhone(e.target.value) })} /></Field>
            </FieldRow>
            <Field label="CPF"><TextInput inputMode="numeric" value={edit.cpf} onChange={(e) => setEdit({ ...edit, cpf: maskCpf(e.target.value) })} /></Field>
          </>
        )}
      </Modal>

      {/* Editar cadastro do paciente */}
      <Modal open={!!editP} onClose={() => setEditP(null)} title="Editar cadastro" subtitle={editP?.name}
        footer={<><Button variant="outline" onClick={() => setEditP(null)}>Cancelar</Button><Button onClick={saveCadastro}>Salvar</Button></>}>
        {editP && (
          <>
            <FieldRow>
              <Field label="Nome"><TextInput value={editP.name} onChange={(e) => setEditP({ ...editP, name: e.target.value })} /></Field>
              <Field label="Perfil"><Select value={editP.perfil ?? 'pediatrico'} onChange={(e) => setEditP({ ...editP, perfil: e.target.value as Perfil })}><option value="pediatrico">Pediátrico</option><option value="estetico">Estético</option><option value="adulto">Adulto</option></Select></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Data de nascimento"><DateField value={editP.birthdate ?? ''} onChange={(iso) => setEditP({ ...editP, birthdate: iso, age: idadeLabel(iso) || editP.age })} /></Field>
              <Field label={`Idade${editP.birthdate ? ' (calculada)' : ''}`}><TextInput value={editP.birthdate ? idadeLabel(editP.birthdate) : editP.age} readOnly={!!editP.birthdate} onChange={(e) => setEditP({ ...editP, age: e.target.value })} /></Field>
            </FieldRow>
            <FieldRow>
              <Field label="Sexo"><Select value={editP.sex ?? ''} onChange={(e) => setEditP({ ...editP, sex: e.target.value })}><option value="">—</option><option>Feminino</option><option>Masculino</option></Select></Field>
              <Field label="Convênio"><Select value={editP.tipo} onChange={(e) => setEditP({ ...editP, tipo: e.target.value as Patient['tipo'] })}><option>Particular</option><option>Convênio</option></Select></Field>
            </FieldRow>
            <FieldRow>
              <Field label="CPF"><TextInput inputMode="numeric" value={editP.cpf ?? ''} onChange={(e) => setEditP({ ...editP, cpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" /></Field>
              <Field label="Telefone"><TextInput inputMode="tel" value={editP.phone ?? ''} onChange={(e) => setEditP({ ...editP, phone: maskPhone(e.target.value) })} placeholder="(45) 90000-0000" /></Field>
            </FieldRow>
            {(editP.perfil ?? 'pediatrico') === 'pediatrico' && (
              <>
                <Field label="Responsável principal"><TextInput value={editP.resp} onChange={(e) => setEditP({ ...editP, resp: e.target.value })} placeholder="Ex.: Ana Paula · mãe" /></Field>
                <FieldRow>
                  <Field label="CPF do responsável"><TextInput inputMode="numeric" value={editP.respCpf ?? ''} onChange={(e) => setEditP({ ...editP, respCpf: maskCpf(e.target.value) })} /></Field>
                  <Field label="Telefone do responsável"><TextInput inputMode="tel" value={editP.respPhone ?? ''} onChange={(e) => setEditP({ ...editP, respPhone: maskPhone(e.target.value) })} /></Field>
                </FieldRow>
              </>
            )}
            <FieldRow>
              <Field label="Prontuário"><TextInput value={editP.prontuario ?? ''} onChange={(e) => setEditP({ ...editP, prontuario: e.target.value })} placeholder="#0428" /></Field>
              <Field label="Status"><Select value={editP.status} onChange={(e) => setEditP({ ...editP, status: e.target.value as TreatStatus })}>{Object.entries(TREAT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
            </FieldRow>
            <Field label="Como conheceu a clínica"><Select value={editP.origem ?? ''} onChange={(e) => setEditP({ ...editP, origem: e.target.value })}><option value="">—</option>{ORIGENS.map((o) => <option key={o} value={o}>{o}</option>)}</Select></Field>
          </>
        )}
      </Modal>
    </div>
  )
}
