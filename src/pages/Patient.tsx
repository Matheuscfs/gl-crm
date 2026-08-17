import { useEffect } from 'react'
import { useParams, Navigate, Link } from 'react-router-dom'
import PatientHeader, { Breadcrumb } from './patient/PatientHeader'
import { EmptyState } from '../components/States'
import { DEMO_DATA } from '../lib/demo'
import Odontograma from './patient/Odontograma'
import Anamnese from './patient/Anamnese'
import Historico from './patient/Historico'
import Evolucao from './patient/Evolucao'
import Planos from './patient/Planos'
import Dados from './patient/Dados'
import FinanceiroPaciente from './patient/FinanceiroPaciente'
import Documentos from './patient/Documentos'
import AntesDepois from './patient/AntesDepois'
import MapaFacial from './patient/MapaFacial'
import { useStore } from '../store'
import { tabsFor, patients as seedPatients, type Patient as PatientT } from '../data'

export default function Patient() {
  const { id, tab } = useParams()
  const { patients, loadAnamnese } = useStore()
  const name = id ? decodeURIComponent(id) : ''
  // sem o cadastro carregado não inventamos um paciente: o fallback de demonstração
  // só vale quando os dados fictícios estão ligados (ver lib/demo.ts)
  const found = patients.find((p) => p.name === name)
  const patient: PatientT | undefined = found ?? (DEMO_DATA ? seedPatients[0] : undefined)
  const patientId = (patient as (PatientT & { _id?: string }) | undefined)?._id ?? null
  const tabs = tabsFor(patient?.perfil)
  const valid = new Set(tabs.map((t) => t.slug))

  useEffect(() => {
    if (patientId) loadAnamnese(patientId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  if (!patient) {
    return (
      <>
        <Breadcrumb name={name || 'Paciente'} />
        <EmptyState
          icon="users"
          title="Paciente não encontrado"
          desc="Este cadastro não está na lista carregada do banco. Volte para Pacientes e abra pela lista."
          action={<Link to="/pacientes" className="btn btn-primary btn-md">Ir para Pacientes</Link>}
        />
      </>
    )
  }

  if (!tab || !valid.has(tab)) {
    return <Navigate to="odontograma" replace />
  }

  let content: React.ReactNode
  switch (tab) {
    case 'odontograma':
      content = <Odontograma initialDentition={patient.perfil === 'pediatrico' ? 'Mista' : 'Permanente'} />
      break
    case 'anamnese':
      content = <Anamnese perfil={patient.perfil} />
      break
    case 'antesdepois':
      content = <AntesDepois />
      break
    case 'mapa':
      content = <MapaFacial />
      break
    case 'historico':
      content = <Historico />
      break
    case 'evolucao':
      content = <Evolucao />
      break
    case 'planos':
      content = <Planos perfil={patient.perfil} />
      break
    case 'dados':
      content = <Dados />
      break
    case 'financeiro':
      content = <FinanceiroPaciente />
      break
    default:
      content = <Documentos />
  }

  return (
    <>
      <Breadcrumb name={patient.name} />
      <PatientHeader activeTab={tab} patient={patient} tabs={tabs} patientId={patientId} />
      <div key={tab} className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {content}
      </div>
    </>
  )
}
