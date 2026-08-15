import { useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import PatientHeader, { Breadcrumb } from './patient/PatientHeader'
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
  const patient: PatientT = patients.find((p) => p.name === name) ?? seedPatients[0]
  const patientId = (patient as PatientT & { _id?: string })._id ?? null
  const tabs = tabsFor(patient.perfil)
  const valid = new Set(tabs.map((t) => t.slug))

  useEffect(() => {
    if (patientId) loadAnamnese(patientId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

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
