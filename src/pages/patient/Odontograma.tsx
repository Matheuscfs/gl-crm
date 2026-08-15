import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../../icons'
import { ToothBox, ToothCol, AnatomicalTooth } from '../../components/Tooth'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Field, Select } from '../../components/Field'
import { Menu } from '../../components/Menu'
import { useParams } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { usePatientId } from '../../lib/useCollection'
import { useStore } from '../../store'
import {
  arches as seedArches,
  deciduousArches,
  TOOTH,
  type ToothState,
  type ToothItem,
} from '../../data'

const DENT_VIEWS = ['Decídua', 'Permanente', 'Mista']
// arcada base "limpa" (todos hígidos) — os estados reais vêm do banco por paciente
const blankState = (list: ToothItem[]) => list.map((t) => ({ ...t, state: 'higido' as ToothState }))
const BLANK_ARCHES = { upR: blankState(seedArches.upR), upL: blankState(seedArches.upL), loR: blankState(seedArches.loR), loL: blankState(seedArches.loL) }
const BLANK_DECIDUOUS = { dUR: blankState(deciduousArches.dUR), dUL: blankState(deciduousArches.dUL), dLR: blankState(deciduousArches.dLR), dLL: blankState(deciduousArches.dLL) }
const TOOTH_GROUP = (num: number) => { const d = num % 10; if (d === 1 || d === 2) return 'Incisivo'; if (d === 3) return 'Canino'; return 'Molar' }
const QUADRANT = (num: number): string => ({ 1: 'Superior direito', 2: 'Superior esquerdo', 3: 'Inferior esquerdo', 4: 'Inferior direito', 5: 'Superior direito (decíduo)', 6: 'Superior esquerdo (decíduo)', 7: 'Inferior esquerdo (decíduo)', 8: 'Inferior direito (decíduo)' })[Math.floor(num / 10)] ?? '—'
const DENTITION = (num: number) => (Math.floor(num / 10) >= 5 ? 'Decídua' : 'Permanente')
const CONDITION_FILTERS: { label: string; state: ToothState | null }[] = [
  { label: 'Todos', state: null },
  { label: 'Cárie', state: 'cariado' },
  { label: 'Restaurado', state: 'restaurado' },
  { label: 'Selante', state: 'selante' },
  { label: 'Em erupção', state: 'erupcao' },
]
const LEGEND: ToothState[] = ['higido', 'cariado', 'restaurado', 'selante', 'ausente', 'erupcao', 'extraido']

// dentition membership by FDI first digit: 1-4 permanent, 5-8 deciduous
const inDentition = (num: number, view: string) => {
  const q = Math.floor(num / 10)
  if (view === 'Permanente') return q >= 1 && q <= 4
  if (view === 'Decídua') return q >= 5 && q <= 8
  return true
}

export default function Odontograma({ initialDentition = 'Mista' }: { initialDentition?: string }) {
  const { toast } = useToast()
  const patientId = usePatientId()
  const { patients } = useStore()
  const { id } = useParams()
  const patient = patients.find((p) => p.name === (id ? decodeURIComponent(id) : ''))
  const [dentView, setDentView] = useState(initialDentition)
  const [chip, setChip] = useState('Todos')
  const [selected, setSelected] = useState(64)
  const [arches, setArches] = useState(BLANK_ARCHES)
  const [editOpen, setEditOpen] = useState(false)
  const [editState, setEditState] = useState<ToothState>('cariado')

  // Carrega os estados dos dentes gravados no banco e aplica sobre a arcada base.
  useEffect(() => {
    if (!supabase || !patientId) return
    let cancelled = false
    supabase.from('teeth').select('num,state').eq('patient_id', patientId).then(({ data, error }) => {
      if (cancelled || error || !data || data.length === 0) return
      const byNum = new Map(data.map((r) => [r.num as number, r.state as ToothState]))
      const apply = (list: ToothItem[]) => list.map((t) => (byNum.has(t.num) ? { ...t, state: byNum.get(t.num)! } : t))
      setArches((a) => ({ upR: apply(a.upR), upL: apply(a.upL), loR: apply(a.loR), loL: apply(a.loL) }))
    })
    return () => { cancelled = true }
  }, [patientId])

  const filterState = CONDITION_FILTERS.find((c) => c.label === chip)?.state ?? null
  const isDim = (t: ToothItem) => !inDentition(t.num, dentView) || (filterState !== null && t.state !== filterState)

  const allTeeth = useMemo(() => [...arches.upR, ...arches.upL, ...arches.loR, ...arches.loL], [arches])
  const selectedState = useMemo(() => allTeeth.find((t) => t.num === selected)?.state ?? 'higido', [allTeeth, selected])
  const recent = useMemo(() => allTeeth.filter((t) => t.state !== 'higido' && t.state !== 'ausente'), [allTeeth])
  const chart = useMemo(() => {
    const counts: Record<string, number> = {}
    allTeeth.forEach((t) => { counts[t.state] = (counts[t.state] ?? 0) + 1 })
    const total = allTeeth.length || 1
    return (['cariado', 'restaurado', 'selante', 'erupcao', 'ausente', 'extraido'] as ToothState[])
      .filter((s) => counts[s]).map((s) => ({ label: TOOTH[s].label, pct: Math.round((counts[s] / total) * 100), color: TOOTH[s].marker }))
  }, [allTeeth])
  const detailRows = [
    { k: 'Dentição', v: DENTITION(selected) },
    { k: 'Quadrante', v: QUADRANT(selected) },
    { k: 'Grupo', v: TOOTH_GROUP(selected) },
    { k: 'Condição', v: TOOTH[selectedState].label },
  ]

  const openEdit = () => {
    setEditState(selectedState)
    setEditOpen(true)
  }

  const applyEdit = (state: ToothState = editState) => {
    const update = (list: ToothItem[]) => list.map((t) => (t.num === selected ? { ...t, state } : t))
    setArches((a) => ({ upR: update(a.upR), upL: update(a.upL), loR: update(a.loR), loL: update(a.loL) }))
    setEditOpen(false)
    if (supabase && patientId) {
      supabase.from('teeth').upsert({ patient_id: patientId, num: selected, state }, { onConflict: 'patient_id,num' })
        .then(({ error }) => { if (error) console.error('[supabase] upsert teeth', error.message) })
    }
    toast(`Dente ${selected} atualizado para ${TOOTH[state].label}.`)
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 322px', gap: 20, alignContent: 'start' }}>
      {/* Left column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 3, background: '#eef2f9', borderRadius: 11, padding: 3 }}>
            {CONDITION_FILTERS.map((c) => (
              <button
                key={c.label}
                onClick={() => setChip(c.label)}
                className="chip"
                style={{
                  padding: '7px 14px',
                  borderRadius: 9,
                  font: "700 12.5px 'Plus Jakarta Sans'",
                  ...(c.label === chip ? { background: '#3f6bf5', color: '#fff' } : { background: 'transparent', color: '#5b647a' }),
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="icon-btn" title="Imprimir" onClick={() => window.print()}><Icon name="print" size={17} /></button>
            <button className="icon-btn" title="Compartilhar" onClick={() => toast('Link do odontograma copiado.', 'info')}><Icon name="share" size={17} /></button>
            <Menu items={[{ label: 'Exportar imagem', onClick: () => toast('Odontograma exportado.', 'info') }, { label: 'Limpar seleção', onClick: () => setChip('Todos') }]} />
            <button className="btn btn-outline btn-sm" onClick={() => setChip((c) => (c === 'Todos' ? 'Cárie' : 'Todos'))}>
              <Icon name="funnel" size={15} /> Filtrar
            </button>
          </div>
        </div>

        {/* Odontograma card */}
        <div className="card" style={{ padding: '22px 22px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ font: "800 15px 'Plus Jakarta Sans'", color: '#1a2426' }}>Odontograma</span>
              <span style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8a9699' }}>dentição {dentView.toLowerCase()}{patient?.age ? ` · ${patient.age}` : ''}</span>
            </div>
            <div style={{ display: 'flex', background: '#f2f4f4', borderRadius: 10, padding: 3 }}>
              {DENT_VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => setDentView(v)}
                  style={{
                    padding: '6px 13px',
                    borderRadius: 7,
                    border: 'none',
                    font: "700 12px 'Plus Jakarta Sans'",
                    cursor: 'pointer',
                    ...(v === dentView ? { background: '#fff', color: '#2f52e0', boxShadow: '0 1px 2px rgba(15,40,45,.1)' } : { background: 'transparent', color: '#8a9699' }),
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div style={{ font: "700 11px 'Plus Jakarta Sans'", color: '#8b93a7', letterSpacing: '.04em', textAlign: 'center', marginBottom: 8 }}>MAXILA</div>
          <div className="arch-gum">
            {arches.upR.map((t) => (
              <AnatomicalTooth key={t.num} tooth={t} upper selected={t.num === selected} dim={isDim(t)} onClick={setSelected} />
            ))}
            <span className="arch-gap" />
            {arches.upL.map((t) => (
              <AnatomicalTooth key={t.num} tooth={t} upper selected={t.num === selected} dim={isDim(t)} onClick={setSelected} />
            ))}
          </div>

          <div style={{ height: 14 }} />

          <div className="arch-gum lower">
            {arches.loR.map((t) => (
              <AnatomicalTooth key={t.num} tooth={t} upper={false} selected={t.num === selected} dim={isDim(t)} onClick={setSelected} />
            ))}
            <span className="arch-gap" />
            {arches.loL.map((t) => (
              <AnatomicalTooth key={t.num} tooth={t} upper={false} selected={t.num === selected} dim={isDim(t)} onClick={setSelected} />
            ))}
          </div>
          <div style={{ font: "700 11px 'Plus Jakarta Sans'", color: '#8b93a7', letterSpacing: '.04em', textAlign: 'center', marginTop: 8 }}>MANDÍBULA</div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 20, paddingTop: 16, borderTop: '1px solid #f0f2f2' }}>
            {LEGEND.map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <ToothBox state={s} size="mini" />
                <span style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#5b6a6d' }}>{TOOTH[s].label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Deciduous reference */}
        <div style={{ background: '#fafbff', border: '1px solid #eef1f1', borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ font: "700 12px 'Plus Jakarta Sans'", color: '#5b6a6d', marginBottom: 12 }}>
            Dentição decídua completa — referência (51–85)
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {BLANK_DECIDUOUS.dUR.map((t) => <ToothCol key={t.num} tooth={t} numOnTop size="sm" />)}
            </div>
            <div style={{ width: 1.5, alignSelf: 'stretch', background: '#e2e5e5', margin: '0 10px' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {BLANK_DECIDUOUS.dUL.map((t) => <ToothCol key={t.num} tooth={t} numOnTop size="sm" />)}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {BLANK_DECIDUOUS.dLR.map((t) => <ToothCol key={t.num} tooth={t} numOnTop={false} size="sm" />)}
            </div>
            <div style={{ width: 1.5, alignSelf: 'stretch', background: '#e2e5e5', margin: '0 10px' }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {BLANK_DECIDUOUS.dLL.map((t) => <ToothCol key={t.num} tooth={t} numOnTop={false} size="sm" />)}
            </div>
          </div>
        </div>

        {/* Condition chart */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#1a2426', marginBottom: 16 }}>Gráfico de condições</div>
          {chart.length === 0 ? (
            <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>Sem condições registradas neste paciente.</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 118 }}>
              {chart.map((c) => (
                <div key={c.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 8, height: '100%' }}>
                  <span style={{ font: "800 11px 'Plus Jakarta Sans'", color: '#1a2426' }}>{c.pct}%</span>
                  <div style={{ width: '100%', height: c.pct * 3 + 10, borderRadius: '7px 7px 0 0', background: c.color }} />
                  <span style={{ font: "600 10.5px 'Plus Jakarta Sans'", color: '#8a9699', textAlign: 'center' }}>{c.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#1a2426' }}>Selecionado</span>
            <Menu items={[{ label: 'Editar condição', onClick: openEdit }, { label: 'Marcar como hígido', onClick: () => applyEdit('higido') }]} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 56, height: 64, borderRadius: 12, flex: 'none', background: TOOTH[selectedState].bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AnatomicalTooth tooth={{ num: selected, state: selectedState }} upper={[1, 2, 5, 6].includes(Math.floor(selected / 10))} width={30} />
            </div>
            <div>
              <div style={{ font: "800 13.5px 'Plus Jakarta Sans'", color: '#2f52e0' }}>Dente {selected} · {TOOTH_GROUP(selected)}</div>
              <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#5b6a6d', marginTop: 3 }}>
                Condição: <b style={{ color: TOOTH[selectedState].fg }}>{TOOTH[selectedState].label}</b>
              </div>
              <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8a9699' }}>{DENTITION(selected)} · {QUADRANT(selected)}</div>
            </div>
          </div>
          {detailRows.map((r) => (
            <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid #f4f6f6' }}>
              <span style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8a9699' }}>{r.k}</span>
              <span style={{ font: "700 12px 'Plus Jakarta Sans'", color: '#1a2426', textAlign: 'right' }}>{r.v}</span>
            </div>
          ))}
          <Button variant="teal-soft" size="sm" block onClick={openEdit} style={{ marginTop: 12 }}>
            Editar condição do dente
          </Button>
        </div>

        <div style={{ font: "800 13px 'Plus Jakarta Sans'", color: '#26324a', margin: '2px 2px 0' }}>Condições registradas {recent.length > 0 && `(${recent.length})`}</div>
        {recent.length === 0 && <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7', padding: '4px 2px' }}>Nenhuma alteração — todos os dentes hígidos.</div>}
        {recent.map((t) => (
          <div key={t.num} className="card card-hover" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 48, borderRadius: 10, flex: 'none', background: TOOTH[t.state].bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AnatomicalTooth tooth={t} upper={[1, 2, 5, 6].includes(Math.floor(t.num / 10))} width={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "800 13px 'Plus Jakarta Sans'", color: '#1a2426' }}>Dente {t.num}</div>
              <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#5b6a6d', marginTop: 2 }}>Condição: {TOOTH[t.state].label}</div>
              <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#8a9699' }}>{DENTITION(t.num)} · {TOOTH_GROUP(t.num)}</div>
            </div>
            <Menu items={[{ label: 'Ver / editar', onClick: () => { setSelected(t.num); setEditState(t.state); setEditOpen(true) } }]} />
          </div>
        ))}
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Dente ${selected}`}
        subtitle="Atualizar condição no odontograma"
        width={380}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => applyEdit()}>Aplicar</Button>
          </>
        }
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 6px' }}>
          <AnatomicalTooth tooth={{ num: selected, state: editState }} upper={[1, 2, 5, 6].includes(Math.floor(selected / 10))} width={38} />
        </div>
        <Field label="Condição">
          <Select value={editState} onChange={(e) => setEditState(e.target.value as ToothState)}>
            {LEGEND.map((s) => (
              <option key={s} value={s}>{TOOTH[s].label}</option>
            ))}
          </Select>
        </Field>
      </Modal>
    </div>
  )
}
