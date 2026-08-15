import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../icons'
import { PERFIL, isSeedPatient, type Patient, type PatientTab } from '../../data'
import { useAnamnese, alertsFromAnamnese } from '../../lib/useAnamnese'
import { confirmLeave } from '../../lib/leaveGuard'
import { uploadAvatar } from '../../lib/storage'
import { useStore } from '../../store'
import { useToast } from '../../components/Toast'
import { AvatarCropper } from '../../components/AvatarCropper'

const PED_ALERTS = ['Alergia a penicilina', 'Asma — broncodilatador (salbutamol)', 'Comportamento: Frankl 3 (positivo)', 'Sucção digital']
const EST_ALERTS = ['Sem gestação (procedimento injetável)', 'Sem alergias relatadas', 'Uso prévio de toxina botulínica']

const brDate = (iso?: string) => {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/** Sticky patient header — altura fixa em todas as sub-abas; só o conteúdo abaixo muda. */
export default function PatientHeader({
  activeTab,
  patient,
  tabs,
  patientId,
}: {
  activeTab: string
  patient: Patient
  tabs: PatientTab[]
  patientId?: string | null
}) {
  const navigate = useNavigate()
  const { id } = useParams()
  const { updatePatient } = useStore()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const est = patient.perfil === 'estetico'
  const escolherFoto = (file: File) => {
    if (!patientId || patientId.startsWith('tmp')) return toast('Foto disponível após o cadastro sincronizar com o banco.', 'info')
    setCropFile(file) // abre o editor de corte/zoom antes de enviar
  }
  const salvarFoto = async (file: File) => {
    setCropFile(null)
    if (!patientId) return
    const url = await uploadAvatar(patientId, file)
    if (!url) return toast('Não foi possível enviar a foto.', 'error')
    updatePatient(patient.name, { photoUrl: url })
    toast('Foto do paciente atualizada.')
  }
  const isChild = (patient.perfil ?? 'pediatrico') === 'pediatrico' // só pediátrico tem responsável
  const p = PERFIL[patient.perfil ?? 'pediatrico']
  const anamnese = useAnamnese(patientId ?? null)
  const derived = alertsFromAnamnese(anamnese, patient.perfil)
  // alertas fixos de demonstração só nos pacientes seed; cadastro novo deriva 100% da anamnese preenchida
  const alerts = derived.length ? derived : isSeedPatient(patient.name) ? (est ? EST_ALERTS : PED_ALERTS) : []
  const avatarBg = est ? 'linear-gradient(150deg, #fdeaf3, #f7d6e6)' : 'linear-gradient(150deg, #e9eeff, #dbe4ff)'
  const avatarFg = est ? '#c2478a' : '#2f52e0'

  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #e7eaea', padding: '20px 28px 0' }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <button
          onClick={() => fileRef.current?.click()}
          title="Alterar foto do paciente"
          style={{ width: 72, height: 72, borderRadius: '50%', flex: 'none', border: 'none', cursor: 'pointer', overflow: 'hidden', padding: 0, background: avatarBg, color: avatarFg, display: 'flex', alignItems: 'center', justifyContent: 'center', font: "800 24px 'Plus Jakarta Sans'", boxShadow: `0 0 0 3px #fff, 0 0 0 4px ${est ? '#fdeaf3' : '#e9eeff'}` }}>
          {patient.photoUrl
            ? <img src={patient.photoUrl} alt={patient.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : patient.initials}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) escolherFoto(f); e.target.value = '' }} />
        <AvatarCropper file={cropFile} onCancel={() => setCropFile(null)} onSave={salvarFoto} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "700 11px 'Plus Jakarta Sans'", color: '#8b93a7', letterSpacing: '.03em', marginBottom: 2 }}>
            Prontuário {patient.prontuario || `#${String(Math.abs(hashName(patient.name)) % 9000 + 1000)}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ font: "800 22px 'Plus Jakarta Sans'", color: '#26324a' }}>{patient.name}</span>
            <span style={{ padding: '4px 11px', borderRadius: 20, background: p.bg, color: p.fg, font: "800 12px 'Plus Jakarta Sans'" }}>{patient.age}</span>
            <span className="pill" style={{ padding: '4px 11px', background: p.bg, color: p.fg }}>{p.label}</span>
            <span style={{ padding: '4px 11px', borderRadius: 20, background: '#eef1f8', color: '#5b647a', font: "700 12px 'Plus Jakarta Sans'" }}>{patient.tipo}</span>
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 9, flexWrap: 'wrap', font: "600 12px 'Plus Jakarta Sans'", color: '#5b647a' }}>
            {isChild && <><span>Responsável: <b style={{ color: '#26324a', fontWeight: 700 }}>{patient.resp}</b></span><span style={{ color: '#c1c8d6' }}>•</span></>}
            {patient.birthdate && <><span>Nascimento: {brDate(patient.birthdate)}</span><span style={{ color: '#c1c8d6' }}>•</span></>}
            <span>Última visita: {patient.last}</span>
            <span style={{ color: '#c1c8d6' }}>•</span>
            <span>Próximo retorno: <b style={{ color: '#3f6bf5', fontWeight: 700 }}>{patient.next}</b></span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
          <button className="btn btn-outline btn-md" onClick={() => { if (confirmLeave()) navigate(`/pacientes/${id}/historico`) }}>Novo atendimento</button>
          <button className="btn btn-primary btn-md" onClick={() => { if (confirmLeave()) navigate('/agenda') }}>
            <Icon name="plus" size={17} /> Agendar
          </button>
        </div>
      </div>

      {/* medical alert banner — vermelho quando há alertas; neutro quando a anamnese ainda não gerou nenhum */}
      {alerts.length > 0 ? (
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', background: '#fbeaea', border: '1px solid #f1cccc', borderLeft: '4px solid #dc2626', borderRadius: 12 }}>
          <span style={{ display: 'flex', flex: 'none', color: '#dc2626' }}><Icon name="alert" size={20} /></span>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {alerts.map((al) => (
              <span key={al} style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#a81e1e' }}>{al}</span>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#f4f6fb', border: '1px solid #e5eaf3', borderRadius: 12 }}>
          <span style={{ display: 'flex', flex: 'none', color: '#8b93a7' }}><Icon name="clipboard" size={17} /></span>
          <span style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#5b647a' }}>
            Sem alertas clínicos — os alertas aparecem aqui automaticamente conforme a anamnese for preenchida.
          </span>
        </div>
      )}

      {/* tabs */}
      <div className="tabs" style={{ marginTop: 14 }}>
        {tabs.map((t) => (
          <button key={t.slug} className={`tab${t.slug === activeTab ? ' active' : ''}`} onClick={() => { if (confirmLeave()) navigate(`/pacientes/${id}/${t.slug}`) }}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function hashName(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

export function Breadcrumb({ name }: { name: string }) {
  return (
    <header style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 24px', background: '#fff', borderBottom: '1px solid #eef1f1' }}>
      <Link to="/pacientes" style={{ display: 'flex', color: '#8a9699' }} onClick={(e) => { if (!confirmLeave()) e.preventDefault() }}><Icon name="back" size={20} /></Link>
      <Link to="/pacientes" style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#8a9699' }} onClick={(e) => { if (!confirmLeave()) e.preventDefault() }}>Pacientes</Link>
      <span style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#c3cbcb' }}>/</span>
      <span style={{ font: "700 12.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{name}</span>
    </header>
  )
}
