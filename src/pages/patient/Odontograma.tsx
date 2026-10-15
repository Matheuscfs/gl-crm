import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
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
// 3D só carrega quando aberto: o Three.js não pesa no resto do app
const Odonto3D = lazy(() => import('./Odonto3D'))
const VIEW_KEY = 'gl-odonto-view'
const lerVista = (): '3d' | '2d' => { try { return localStorage.getItem(VIEW_KEY) === '2d' ? '2d' : '3d' } catch { return '3d' } }
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
  const [vista, setVista] = useState<'3d' | '2d'>(lerVista)
  const trocarVista = (v: '3d' | '2d') => { setVista(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* só nesta aba */ } }

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

  const upperOf = (num: number) => [1, 2, 5, 6].includes(Math.floor(num / 10))

  return (
    <div className="tab-body">
      <div className="home-cols">
        <div className="home-main">
          <div className="tab-head" style={{ marginBottom: 0 }}>
            <div className="seg-sm" role="group" aria-label="Filtrar por condição">
              {CONDITION_FILTERS.map((c) => (
                <button key={c.label} aria-pressed={c.label === chip} onClick={() => setChip(c.label)}>{c.label}</button>
              ))}
            </div>
            <button className="btn-soft" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="print" size={15} /> Imprimir
            </button>
          </div>

          <section className="panel" aria-labelledby="odonto-titulo">
            <div className="panel-head" style={{ marginBottom: 14 }}>
              <h2 id="odonto-titulo" className="panel-title">
                Odontograma <span style={{ font: '400 12.5px var(--font)', color: 'var(--muted)' }}>dentição {dentView.toLowerCase()}{patient?.age ? ` · ${patient.age}` : ''}</span>
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <div className="seg-sm" role="group" aria-label="Dentição">
                  {DENT_VIEWS.map((v) => <button key={v} aria-pressed={v === dentView} onClick={() => setDentView(v)}>{v}</button>)}
                </div>
                <div className="seg-sm" role="group" aria-label="Visualização">
                  <button aria-pressed={vista === '3d'} onClick={() => trocarVista('3d')}>3D</button>
                  <button aria-pressed={vista === '2d'} onClick={() => trocarVista('2d')}>2D</button>
                </div>
              </div>
            </div>

            {vista === '3d' ? (
              <Suspense fallback={<div className="o3d-stage skeleton" aria-busy="true" />}>
                <Odonto3D upper={[...arches.upR, ...arches.upL]} lower={[...arches.loR, ...arches.loL]} selected={selected} onSelect={setSelected} isDim={isDim} />
              </Suspense>
            ) : (<>

            <div style={{ font: '500 11px var(--font)', color: 'var(--muted)', letterSpacing: '.06em', textAlign: 'center', marginBottom: 8 }}>MAXILA</div>
            <div className="arch-gum">
              {arches.upR.map((t) => <AnatomicalTooth key={t.num} tooth={t} upper selected={t.num === selected} dim={isDim(t)} onClick={setSelected} />)}
              <span className="arch-gap" />
              {arches.upL.map((t) => <AnatomicalTooth key={t.num} tooth={t} upper selected={t.num === selected} dim={isDim(t)} onClick={setSelected} />)}
            </div>
            <div style={{ height: 12 }} />
            <div className="arch-gum lower">
              {arches.loR.map((t) => <AnatomicalTooth key={t.num} tooth={t} upper={false} selected={t.num === selected} dim={isDim(t)} onClick={setSelected} />)}
              <span className="arch-gap" />
              {arches.loL.map((t) => <AnatomicalTooth key={t.num} tooth={t} upper={false} selected={t.num === selected} dim={isDim(t)} onClick={setSelected} />)}
            </div>
            <div style={{ font: '500 11px var(--font)', color: 'var(--muted)', letterSpacing: '.06em', textAlign: 'center', marginTop: 8 }}>MANDÍBULA</div>
            </>)}

            <div className="legend-row">
              {LEGEND.map((s) => <div key={s}><ToothBox state={s} size="mini" />{TOOTH[s].label}</div>)}
            </div>
          </section>

        </div>

        <aside className="home-aside wrap-row" aria-label="Dente selecionado">
          <section className="panel">
            <div className="panel-head" style={{ marginBottom: 12 }}>
              <h2 className="panel-title sm">Dente selecionado</h2>
              <Menu items={[{ label: 'Editar condição', onClick: openEdit }, { label: 'Marcar como hígido', onClick: () => applyEdit('higido') }]} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <div className="tooth-thumb" style={{ width: 56, height: 64, background: TOOTH[selectedState].bg }}>
                <AnatomicalTooth tooth={{ num: selected, state: selectedState }} upper={upperOf(selected)} width={30} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 14px var(--font)', color: 'var(--ink)' }}>Dente {selected} · {TOOTH_GROUP(selected)}</div>
                <div style={{ font: '400 12.5px var(--font)', color: 'var(--slate)', marginTop: 3 }}>
                  Condição: <b style={{ fontWeight: 600, color: TOOTH[selectedState].fg }}>{TOOTH[selectedState].label}</b>
                </div>
                <div style={{ font: '400 12px var(--font)', color: 'var(--muted)' }}>{DENTITION(selected)} · {QUADRANT(selected)}</div>
              </div>
            </div>
            {detailRows.map((r) => <div key={r.k} className="kv-row"><span>{r.k}</span><span>{r.v}</span></div>)}
            <button className="btn-cta" style={{ width: '100%', marginTop: 12 }} onClick={openEdit}>Editar condição do dente</button>
          </section>

          <section className="panel">
            <h2 className="panel-title sm">Dentes com alteração {recent.length > 0 && <span style={{ font: '400 12.5px var(--font)', color: 'var(--muted)' }}>{recent.length}</span>}</h2>
            {recent.length === 0 ? (
              <p className="empty-note">Nenhuma alteração — todos os dentes hígidos.</p>
            ) : (
              <div className="row-list" style={{ marginTop: 6 }}>
                {recent.map((t) => (
                  <div key={t.num}>
                    <button className="tooth-thumb" onClick={() => setSelected(t.num)} aria-label={`Selecionar dente ${t.num}`} style={{ width: 40, height: 48, border: 'none', cursor: 'pointer', background: TOOTH[t.state].bg }}>
                      <AnatomicalTooth tooth={t} upper={upperOf(t.num)} width={24} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '500 13px var(--font)', color: 'var(--ink)' }}>Dente {t.num} · {TOOTH[t.state].label}</div>
                      <div style={{ font: '400 12px var(--font)', color: 'var(--muted)' }}>{DENTITION(t.num)} · {TOOTH_GROUP(t.num)}</div>
                    </div>
                    <Menu items={[{ label: 'Ver / editar', onClick: () => { setSelected(t.num); setEditState(t.state); setEditOpen(true) } }]} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* referências abaixo: no tablet em pé o dente selecionado fica logo depois da arcada */}
      <div className="home-cols" style={{ marginTop: 18, alignItems: 'stretch' }}>
        {/* referência da dentição decídua */}
        <section className="deciduous-ref" aria-label="Dentição decídua completa" style={{ flex: '1 1 380px', minWidth: 0 }}>
          <div style={{ font: '500 12px var(--font)', color: 'var(--slate)', marginBottom: 12 }}>Dentição decídua completa — referência (51–85)</div>
          <div className="row">
            <div style={{ display: 'flex', gap: 4 }}>{BLANK_DECIDUOUS.dUR.map((t) => <ToothCol key={t.num} tooth={t} numOnTop size="sm" />)}</div>
            <div style={{ width: 1.5, alignSelf: 'stretch', background: 'var(--line)', margin: '0 10px' }} />
            <div style={{ display: 'flex', gap: 4 }}>{BLANK_DECIDUOUS.dUL.map((t) => <ToothCol key={t.num} tooth={t} numOnTop size="sm" />)}</div>
          </div>
          <div className="row">
            <div style={{ display: 'flex', gap: 4 }}>{BLANK_DECIDUOUS.dLR.map((t) => <ToothCol key={t.num} tooth={t} numOnTop={false} size="sm" />)}</div>
            <div style={{ width: 1.5, alignSelf: 'stretch', background: 'var(--line)', margin: '0 10px' }} />
            <div style={{ display: 'flex', gap: 4 }}>{BLANK_DECIDUOUS.dLL.map((t) => <ToothCol key={t.num} tooth={t} numOnTop={false} size="sm" />)}</div>
          </div>
        </section>

        <section className="panel" aria-labelledby="cond-titulo" style={{ flex: '1 1 300px', minWidth: 0 }}>
          <h2 id="cond-titulo" className="panel-title sm">Condições registradas</h2>
          {chart.length === 0 ? (
            <p className="empty-note">Sem condições registradas neste paciente.</p>
          ) : (
            <div className="cond-bars" role="img" aria-label={chart.map((c) => `${c.label} ${c.pct}%`).join(', ')}>
              {chart.map((c) => (
                <div key={c.label}>
                  <b>{c.pct}%</b>
                  <i style={{ height: c.pct * 3 + 10, background: c.color }} />
                  <span>{c.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>
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
          <AnatomicalTooth tooth={{ num: selected, state: editState }} upper={upperOf(selected)} width={38} />
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
