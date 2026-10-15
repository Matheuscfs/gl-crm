import { useEffect } from 'react'
import { useParams, Navigate, Link } from 'react-router-dom'
import PatientHeader from './patient/PatientHeader'
import { EmptyState, SkeletonRows } from '../components/States'
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
import { useStore, patientPath } from '../store'
import { tabsFor, patients as seedPatients, type Patient as PatientT } from '../data'

export default function Patient() {
  const { id, tab } = useParams()
  const { findPatient, loadAnamnese, carga } = useStore()
  // a rota traz o id do paciente (links antigos com o nome continuam funcionando)
  const found = findPatient(id)
  const name = found?.name ?? (id ? decodeURIComponent(id) : '')
  // sem o cadastro carregado não inventamos um paciente: o fallback de demonstração
  // só vale quando os dados fictícios estão ligados (ver lib/demo.ts)
  const patient: PatientT | undefined = found ?? (DEMO_DATA && !id ? seedPatients[0] : undefined)
  const patientId = found && !found._id.startsWith('tmp') && !found._id.startsWith('seed') ? found._id : null
  const tabs = tabsFor(patient?.perfil)
  const valid = new Set(tabs.map((t) => t.slug))

  useEffect(() => {
    if (patientId) loadAnamnese(patientId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  // enquanto o banco carrega, não acusa "paciente não encontrado"
  if (!found && carga === 'carregando') {
    return <div className="ficha-page"><div className="tab-body"><SkeletonRows rows={6} /></div></div>
  }

  // link antigo (pelo nome) ou com id provisório: troca pelo endereço definitivo da ficha
  if (found && id && decodeURIComponent(id) !== found._id && !found._id.startsWith('tmp')) {
    return <Navigate to={patientPath(found, tab)} replace />
  }

  if (!patient) {
    return (
      <>
        <header className="topbar"><h1 className="topbar-title">{name || 'Paciente'}</h1></header>
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
    <div className="ficha-page">
      <PatientHeader activeTab={tab} patient={patient} tabs={tabs} patientId={patientId} />
      <div key={tab} className="ficha-body fade-in">
        {content}
      </div>
    </div>
  )
}
