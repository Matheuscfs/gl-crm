import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { usePatientId } from '../../lib/useCollection'
import { useLeaveGuard } from '../../lib/leaveGuard'
import { useStore } from '../../store'
import { isSeedPatient, type Perfil } from '../../data'

type Field =
  | { id: string; label: string; type: 'text' | 'number' }
  | { id: string; label: string; type: 'yesno'; detail?: boolean }
  | { id: string; label: string; type: 'select'; options: string[] }
  | { id: string; label: string; type: 'checks'; options: string[] }
interface Sec { title: string; fields: Field[] }

const PED_SECTIONS: Sec[] = [
  { title: 'Clínico', fields: [
    { id: 'queixa', label: 'Queixa principal', type: 'text' },
    { id: 'doenca', label: 'Possui doença/síndrome?', type: 'yesno', detail: true },
    { id: 'medicamentos', label: 'Medicamentos contínuos?', type: 'yesno', detail: true },
    { id: 'alergia', label: 'Alergia?', type: 'yesno', detail: true },
  ] },
  { title: 'Histórico', fields: [
    { id: 'cirurgia', label: 'Já realizou cirurgia?', type: 'yesno' },
    { id: 'anestesia', label: 'Reação à anestesia?', type: 'yesno' },
    { id: 'trat_previo', label: 'Tratamento odontológico prévio?', type: 'yesno' },
    { id: 'exp_negativa', label: 'Experiência negativa?', type: 'yesno' },
    { id: 'sedacao', label: 'Já realizou sedação?', type: 'yesno' },
    { id: 'contencao', label: 'Contenção física?', type: 'yesno' },
    { id: 'dor', label: 'Apresenta dor atualmente?', type: 'yesno' },
    { id: 'sangramento', label: 'Sangramento gengival?', type: 'yesno' },
    { id: 'sensibilidade', label: 'Sensibilidade dentária?', type: 'yesno' },
  ] },
  { title: 'Higiene', fields: [
    { id: 'escovacao', label: 'Escovação (vezes/dia)', type: 'number' },
    { id: 'fio', label: 'Uso de fio dental?', type: 'yesno' },
    { id: 'creme_fluor', label: 'Creme fluoretado?', type: 'yesno' },
    { id: 'quem_escova', label: 'Quem escova', type: 'select', options: ['Pais', 'Criança', 'Supervisionado'] },
  ] },
  { title: 'Gestação, nascimento e hábitos', fields: [
    { id: 'gestacao', label: 'Gestação', type: 'select', options: ['Normal', 'Risco'] },
    { id: 'nascimento', label: 'Nascimento', type: 'select', options: ['Normal', 'Cesárea'] },
    { id: 'habitos', label: 'Hábitos', type: 'checks', options: ['Chupeta', 'Mamadeira', 'Sucção de dedo', 'Roer unhas', 'Bruxismo', 'Respiração bucal'] },
  ] },
  { title: 'Dieta e comportamento', fields: [
    { id: 'doces', label: 'Consumo de doces', type: 'select', options: ['Nunca', 'Às vezes', 'Todos os dias'] },
    { id: 'refri', label: 'Refrigerante', type: 'select', options: ['Nunca', 'Às vezes', 'Todos os dias'] },
    { id: 'amamentacao', label: 'Amamentação', type: 'select', options: ['Materna', 'Fórmula'] },
    { id: 'mamadeira_noturna', label: 'Mamadeira noturna?', type: 'yesno' },
    { id: 'comportamento', label: 'Comportamento', type: 'select', options: ['Muito tranquila', 'Ansiosa', 'Chora', 'Agressiva', 'Colaboradora'] },
  ] },
]

const ADULT_SECTIONS: Sec[] = [
  { title: 'Clínico', fields: [
    { id: 'queixa', label: 'Queixa principal', type: 'text' },
    { id: 'doenca', label: 'Possui doença?', type: 'yesno', detail: true },
    { id: 'medicamentos', label: 'Medicamentos contínuos?', type: 'yesno', detail: true },
    { id: 'alergia', label: 'Alergia?', type: 'yesno', detail: true },
  ] },
  { title: 'Histórico', fields: [
    { id: 'cirurgia', label: 'Já realizou cirurgia?', type: 'yesno' },
    { id: 'anestesia', label: 'Reação à anestesia?', type: 'yesno' },
    { id: 'trat_previo', label: 'Tratamento odontológico prévio?', type: 'yesno' },
    { id: 'dor', label: 'Apresenta dor atual?', type: 'yesno' },
    { id: 'sangramento', label: 'Sangramento gengival?', type: 'yesno' },
    { id: 'sensibilidade', label: 'Sensibilidade dentária?', type: 'yesno' },
  ] },
  { title: 'Higiene', fields: [
    { id: 'escovacao', label: 'Escovação (vezes/dia)', type: 'number' },
    { id: 'fio', label: 'Uso de fio dental?', type: 'yesno' },
  ] },
  { title: 'Procedimentos estéticos', fields: [
    { id: 'est_anteriores', label: 'Procedimentos estéticos anteriores?', type: 'yesno', detail: true },
    { id: 'toxina_previa', label: 'Uso prévio de toxina botulínica?', type: 'yesno' },
    { id: 'ah_previo', label: 'Uso prévio de ácido hialurônico?', type: 'yesno' },
    { id: 'expectativas', label: 'Expectativas do paciente', type: 'text' },
  ] },
]

const PED_DEFAULTS: Record<string, unknown> = {
  queixa: 'Revisão e manutenção', doenca: true, doenca_d: 'Asma', medicamentos: true, medicamentos_d: 'Salbutamol',
  alergia: true, alergia_d: 'Penicilina', trat_previo: true, escovacao: '2', fio: true, creme_fluor: true,
  quem_escova: 'Supervisionado', gestacao: 'Normal', nascimento: 'Cesárea', habitos: ['Sucção de dedo'],
  doces: 'Às vezes', refri: 'Nunca', amamentacao: 'Materna', mamadeira_noturna: false, comportamento: 'Colaboradora',
}
const ADULT_DEFAULTS: Record<string, unknown> = {
  queixa: 'Harmonização — linhas de expressão', est_anteriores: true, est_anteriores_d: 'Toxina botulínica (2025)',
  toxina_previa: true, ah_previo: false, escovacao: '3', fio: true,
}

export default function Anamnese({ perfil }: { perfil?: Perfil }) {
  const { toast } = useToast()
  const patientId = usePatientId()
  const { anamnese: anamneseStore, saveAnamnese } = useStore()
  const adultForm = perfil === 'estetico' || perfil === 'adulto' // adulto e estético usam a anamnese de adulto
  const sections = adultForm ? ADULT_SECTIONS : PED_SECTIONS
  const { id } = useParams()
  // respostas demo só para pacientes de demonstração — cadastro novo começa em branco
  const defaults = isSeedPatient(id ? decodeURIComponent(id) : '') ? (adultForm ? ADULT_DEFAULTS : PED_DEFAULTS) : {}
  const [data, setData] = useState<Record<string, unknown>>(defaults)
  const [saving, setSaving] = useState(false)
  // snapshot do último estado salvo — base do aviso de "dados não salvos"
  const savedRef = useRef(JSON.stringify(defaults))

  useEffect(() => {
    const cached = patientId ? anamneseStore[patientId] : undefined
    const base = cached ?? defaults
    setData(base)
    savedRef.current = JSON.stringify(base)
    if (cached || !supabase || !patientId) return
    let cancelled = false
    supabase.from('anamnese').select('data').eq('patient_id', patientId).maybeSingle().then(({ data: row, error }) => {
      if (cancelled || error || !row?.data) return
      setData(row.data as Record<string, unknown>)
      savedRef.current = JSON.stringify(row.data)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, adultForm])

  const dirty = JSON.stringify(data) !== savedRef.current
  useLeaveGuard(dirty, 'A anamnese tem alterações não salvas — ao sair elas serão perdidas. Sair mesmo assim?')

  const set = (id: string, v: unknown) => setData((d) => ({ ...d, [id]: v }))

  const salvar = () => {
    setSaving(true)
    setTimeout(() => {
      if (patientId) saveAnamnese(patientId, data)
      savedRef.current = JSON.stringify(data)
      setSaving(false)
      toast('Anamnese salva.')
    }, 400)
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '18px 28px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ font: "800 15px 'Plus Jakarta Sans'", color: '#26324a' }}>Anamnese {adultForm ? 'do adulto' : 'pediátrica'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {dirty && <span style={{ font: "700 11.5px 'Plus Jakarta Sans'", color: '#c48a1a' }}>● alterações não salvas</span>}
          <Button loading={saving} onClick={salvar}>Salvar anamnese</Button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        {sections.map((s) => (
          <div key={s.title} className="card card-hover" style={{ padding: '18px 20px' }}>
            <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 6 }}>{s.title}</div>
            {s.fields.map((f) => <FieldRow key={f.id} f={f} value={data[f.id]} detail={data[`${f.id}_d`]} set={set} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

function FieldRow({ f, value, detail, set }: { f: Field; value: unknown; detail: unknown; set: (id: string, v: unknown) => void }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #f2f5fb' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>{f.label}</span>
        {f.type === 'yesno' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[['Não', false], ['Sim', true]].map(([lbl, val]) => {
              const on = value === val
              return (
                <button key={String(val)} className="chip" onClick={() => set(f.id, val)}
                  style={{ padding: '5px 12px', borderRadius: 8, font: "700 11.5px 'Plus Jakarta Sans'", border: `1px solid ${on ? '#cdd8ff' : '#e5e9f2'}`, background: on ? '#e9eeff' : '#fff', color: on ? '#2f52e0' : '#8b93a7' }}>
                  {lbl}
                </button>
              )
            })}
          </div>
        )}
        {f.type === 'select' && (
          <select className="field-select" style={{ width: 'auto', minWidth: 130, height: 34 }} value={String(value ?? '')} onChange={(e) => set(f.id, e.target.value)}>
            <option value=""></option>
            {f.options.map((o) => <option key={o}>{o}</option>)}
          </select>
        )}
        {(f.type === 'text' || f.type === 'number') && (
          <input className="field-input" style={{ width: 200, height: 34 }} type={f.type === 'number' ? 'number' : 'text'} value={String(value ?? '')} onChange={(e) => set(f.id, e.target.value)} />
        )}
      </div>
      {f.type === 'yesno' && f.detail && value === true && (
        <input className="field-input" style={{ marginTop: 8, height: 34 }} placeholder="Qual?" value={String(detail ?? '')} onChange={(e) => set(`${f.id}_d`, e.target.value)} />
      )}
      {f.type === 'checks' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {f.options.map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : []
            const on = arr.includes(o)
            return (
              <button key={o} className="chip" onClick={() => set(f.id, on ? arr.filter((x) => x !== o) : [...arr, o])}
                style={{ padding: '5px 11px', borderRadius: 20, font: "700 11px 'Plus Jakarta Sans'", border: `1px solid ${on ? '#cdd8ff' : '#e5e9f2'}`, background: on ? '#e9eeff' : '#fff', color: on ? '#2f52e0' : '#8b93a7' }}>
                {o}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
