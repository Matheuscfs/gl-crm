import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../../icons'
import { PERFIL, idadeLabel, isSeedPatient, type Patient, type PatientTab } from '../../data'
import { useAnamnese, alertsFromAnamnese } from '../../lib/useAnamnese'
import { sairSePuder } from '../../lib/leaveGuard'
import { uploadAvatar } from '../../lib/storage'
import { useStore } from '../../store'
import { useToast } from '../../components/Toast'
import { AvatarCropper } from '../../components/AvatarCropper'
import { PatientPhoto } from '../../components/PatientPhoto'
import { brDate } from '../../lib/dates'
import { diasDeRetornoVencido } from '../../lib/retornos'
import { waLink, contactPhone, contactName } from '../../lib/whats'
import { BRAND } from '../../brand'

const PED_ALERTS = ['Alergia a penicilina', 'Asma — broncodilatador (salbutamol)', 'Comportamento: Frankl 3 (positivo)', 'Sucção digital']
const EST_ALERTS = ['Sem gestação (procedimento injetável)', 'Sem alergias relatadas', 'Uso prévio de toxina botulínica']

const PERFIL_CHIP = { pediatrico: 'ped', estetico: 'est', adulto: 'adt' } as const

/** Cabeçalho da ficha — fixo em todas as abas; só o conteúdo abaixo muda. */
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
  const perfil = patient.perfil ?? 'pediatrico'
  const est = perfil === 'estetico'
  const escolherFoto = (file: File) => {
    if (!patientId || patientId.startsWith('tmp')) return toast('Foto disponível após o cadastro sincronizar com o banco.', 'info')
    setCropFile(file) // abre o editor de corte/zoom antes de enviar
  }
  const salvarFoto = async (file: File) => {
    setCropFile(null)
    if (!patientId) return
    const url = await uploadAvatar(patientId, file)
    if (!url) return toast('Não foi possível enviar a foto.', 'error')
    const ok = await updatePatient(patientId, { photoUrl: url })
    if (!ok) return
    toast('Foto do paciente atualizada.')
  }
  const isChild = perfil === 'pediatrico' // só pediátrico tem responsável
  const anamnese = useAnamnese(patientId ?? null)
  const derived = alertsFromAnamnese(anamnese, patient.perfil)
  // alertas fixos de demonstração só nos pacientes seed; cadastro novo deriva 100% da anamnese preenchida
  const alerts = derived.length ? derived : isSeedPatient(patient) ? (est ? EST_ALERTS : PED_ALERTS) : []
  const idade = (patient.birthdate ? idadeLabel(patient.birthdate) : '') || (patient.age !== '—' ? patient.age : '')
  const diasVencido = diasDeRetornoVencido(patient)
  const temAnamnese = tabs.some((t) => t.slug === 'anamnese')

  const ir = (slug: string) => sairSePuder(() => navigate(`/pacientes/${id}/${slug}`))
  const chamar = () => {
    const link = waLink(contactPhone(patient), `Oi, ${contactName(patient, patient.name)}! Aqui é do consultório da ${BRAND.dentist}.`)
    if (!link) return toast(`Sem telefone cadastrado para ${patient.name}. Complete em Dados e responsáveis.`, 'error')
    window.open(link, '_blank', 'noopener')
  }

  return (
    <div className="ficha-head">
      <section className="panel ficha-card" aria-label="Paciente">
        <button className={`ficha-avatar${est ? ' est' : ''}`} onClick={() => fileRef.current?.click()} title="Alterar foto do paciente" aria-label="Alterar foto do paciente">
          <PatientPhoto src={patient.photoUrl} alt={patient.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} fallback={patient.initials} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) escolherFoto(f); e.target.value = '' }} />
        <AvatarCropper file={cropFile} onCancel={() => setCropFile(null)} onSave={salvarFoto} />

        <div className="ficha-info">
          <h1 className="ficha-name">{patient.name}</h1>
          <div className="ficha-chips">
            {idade && <span className="ficha-chip">{idade}</span>}
            <span className={`ficha-chip ${PERFIL_CHIP[perfil]}`}>{PERFIL[perfil].label}</span>
            <span className="ficha-chip">{patient.tipo}</span>
            {/* sem número inventado: só mostra o prontuário quando foi cadastrado */}
            {patient.prontuario && <span className="ficha-chip">Prontuário {patient.prontuario.replace(/^#/, '')}</span>}
          </div>
          <p className="ficha-meta">
            {isChild && patient.resp && patient.resp !== '—' && <>Responsável: <b>{patient.resp}</b> · </>}
            {patient.birthdate && <>nascimento {brDate(patient.birthdate)} · </>}
            última visita {patient.last && patient.last !== '—' ? patient.last : 'nenhuma'} · próximo retorno{' '}
            {diasVencido !== null
              ? <b className="danger">{diasVencido > 0 ? `vencido há ${diasVencido} dia${diasVencido === 1 ? '' : 's'}` : 'vencido'}</b>
              : <b className="info">{patient.next && patient.next !== '—' ? patient.next : 'a definir'}</b>}
          </p>
        </div>

        <div className="ficha-actions">
          <button className="btn-soft" style={{ height: 40, padding: '0 14px', borderRadius: 11, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={chamar}>
            <Icon name="wa" size={16} /> WhatsApp
          </button>
          <button className="btn-soft" style={{ height: 40, padding: '0 14px', borderRadius: 11 }} onClick={() => ir('historico')}>Novo atendimento</button>
          <button className="btn-cta" onClick={() => sairSePuder(() => navigate('/agenda'))}>Agendar retorno</button>
        </div>
      </section>

      {/* alertas clínicos: escritos por extenso; sem alerta, um aviso neutro diz de onde eles vêm */}
      {alerts.length > 0 ? (
        <section className="ficha-alerts" aria-label="Alertas clínicos">
          <span style={{ display: 'flex', color: 'var(--danger)' }}><Icon name="alert" size={17} /></span>
          {alerts.map((al, i) => (
            <span key={al} style={{ display: 'contents' }}>
              {i > 0 && <span className="sep" aria-hidden="true">·</span>}
              <span className="alerta">{al}</span>
            </span>
          ))}
          {temAnamnese && activeTab !== 'anamnese' && <button className="panel-link" style={{ marginLeft: 'auto' }} onClick={() => ir('anamnese')}>Ver anamnese</button>}
        </section>
      ) : (
        <section className="ficha-alerts vazio">
          <span style={{ display: 'flex', color: 'var(--muted)' }}><Icon name="clipboard" size={16} /></span>
          <span style={{ font: '400 12.5px var(--font)', color: 'var(--slate)' }}>Sem alertas clínicos. Eles aparecem aqui conforme a anamnese for preenchida.</span>
        </section>
      )}

      <nav className="ficha-tabs" aria-label="Seções da ficha">
        {tabs.map((t) => (
          <button key={t.slug} aria-current={t.slug === activeTab ? 'page' : undefined} onClick={() => ir(t.slug)}>{t.label}</button>
        ))}
      </nav>
    </div>
  )
}
