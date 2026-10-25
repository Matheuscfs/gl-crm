import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Icon } from '../../icons'
import { ToothBox, AnatomicalTooth, FaceDiagram, rotuloFace, nomeFace, type Face, type Faces } from '../../components/Tooth'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Field, Select } from '../../components/Field'
import { Menu } from '../../components/Menu'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { esquema } from '../../lib/sync'
import { usePatient } from '../../lib/useCollection'
import { idadeAnos } from '../../lib/dates'
import { DocumentViewer } from '../documents/DocKit'
import { DOCUMENTS } from '../documents/templates'
import { TOOTH, type ToothState, type ToothItem } from '../../data'
import IndicesClinicos from './IndicesClinicos'

type Dentição = 'Decídua' | 'Mista' | 'Permanente'
const DENT_VIEWS: Dentição[] = ['Decídua', 'Mista', 'Permanente']
// 3D só carrega quando aberto: o Three.js não pesa no resto do app
const Odonto3D = lazy(() => import('./Odonto3D'))
const VIEW_KEY = 'gl-odonto-view'
const lerVista = (): '3d' | '2d' => { try { return localStorage.getItem(VIEW_KEY) === '2d' ? '2d' : '3d' } catch { return '3d' } }

const seq = (de: number, ate: number) => { const out: number[] = []; for (let n = de; de > ate ? n >= ate : n <= ate; n += de > ate ? -1 : 1) out.push(n); return out }

/**
 * Layout de cada dentição (FDI), na ordem em que aparece na tela: lado direito do paciente à
 * esquerda. Antes havia um só layout misto e a "Permanente" escondia dentes — faltavam 13–15, 17 e 18.
 */
const LAYOUT: Record<Dentição, { upR: number[]; upL: number[]; loR: number[]; loL: number[] }> = {
  Permanente: { upR: seq(18, 11), upL: seq(21, 28), loR: seq(48, 41), loL: seq(31, 38) },
  Decídua: { upR: seq(55, 51), upL: seq(61, 65), loR: seq(85, 81), loL: seq(71, 75) },
  // dentição mista típica (6–12 anos): incisivos e 1º molar permanentes + caninos e molares decíduos
  Mista: { upR: [16, 55, 54, 53, 12, 11], upL: [21, 22, 63, 64, 65, 26], loR: [46, 85, 84, 83, 42, 41], loL: [31, 32, 73, 74, 75, 36] },
}

/** Dentição que abre por padrão, pela idade. */
const dentPorIdade = (anos: number | null, perfilPed: boolean): Dentição =>
  anos === null ? (perfilPed ? 'Mista' : 'Permanente') : anos < 6 ? 'Decídua' : anos < 12 ? 'Mista' : 'Permanente'

const TOOTH_GROUP = (num: number) => { const d = num % 10; if (d === 1 || d === 2) return 'Incisivo'; if (d === 3) return 'Canino'; if (Math.floor(num / 10) < 5 && (d === 4 || d === 5)) return 'Pré-molar'; return 'Molar' }
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
/** Condições do dente inteiro (as de face — cárie, restauração, selante — vão no diagrama). */
const ESTADOS_DENTE: ToothState[] = ['higido', 'ausente', 'erupcao', 'extraido']
const ESTADOS_FACE: ToothState[] = ['cariado', 'restaurado', 'selante']

interface Registro { state: ToothState; faces: Faces }

/** Condição-resumo do dente: o pior achado das faces quando o dente está presente. */
function resumo(r: Registro): ToothState {
  if (r.state === 'ausente' || r.state === 'extraido' || r.state === 'erupcao') return r.state
  const vals = Object.values(r.faces)
  if (vals.includes('cariado')) return 'cariado'
  if (vals.includes('restaurado')) return 'restaurado'
  if (vals.includes('selante')) return 'selante'
  return r.state
}
/** "Cárie (O, M) · Restauração (D)" */
export function textoFaces(num: number, faces: Faces): string {
  const por = new Map<ToothState, string[]>()
  ;(Object.entries(faces) as [Face, ToothState][]).forEach(([f, st]) => { por.set(st, [...(por.get(st) ?? []), rotuloFace(f, num)]) })
  return [...por.entries()].map(([st, fs]) => `${TOOTH[st].label} (${fs.join(', ')})`).join(' · ')
}

export default function Odontograma({ initialDentition }: { initialDentition?: string }) {
  const { toast } = useToast()
  const { patient, patientId, demo } = usePatient()
  const [dentView, setDentView] = useState<Dentição>(() =>
    (DENT_VIEWS as string[]).includes(initialDentition ?? '') && !patient?.birthdate
      ? (initialDentition as Dentição)
      : dentPorIdade(idadeAnos(patient?.birthdate), (patient?.perfil ?? 'pediatrico') === 'pediatrico'))
  const [chip, setChip] = useState('Todos')
  const [registros, setRegistros] = useState<Map<number, Registro>>(() => new Map(demo ? [
    [64, { state: 'higido', faces: { O: 'cariado', M: 'cariado' } }], [54, { state: 'higido', faces: { O: 'restaurado' } }],
    [75, { state: 'higido', faces: { D: 'cariado' } }], [85, { state: 'higido', faces: { O: 'selante' } }],
    [42, { state: 'ausente', faces: {} }], [26, { state: 'erupcao', faces: {} }],
  ] : []))
  const layout = LAYOUT[dentView]
  const todosNums = useMemo(() => [...layout.upR, ...layout.upL, ...layout.loR, ...layout.loL], [layout])
  const [selected, setSelected] = useState<number>(() => todosNums[Math.floor(todosNums.length / 4)])
  const [editOpen, setEditOpen] = useState(false)
  const [rascunho, setRascunho] = useState<Registro>({ state: 'higido', faces: {} })
  const [ferramenta, setFerramenta] = useState<ToothState>('cariado')
  const [salvando, setSalvando] = useState(false)
  const [imprimindo, setImprimindo] = useState(false)
  const [vista, setVista] = useState<'3d' | '2d'>(lerVista)
  const trocarVista = (v: '3d' | '2d') => { setVista(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* só nesta aba */ } }

  // Carrega os dentes gravados (estado + faces, quando o banco já tem a coluna).
  useEffect(() => {
    if (!supabase || !patientId) return
    let cancelled = false
    supabase.from('teeth').select('*').eq('patient_id', patientId).then(({ data, error }) => {
      if (cancelled || error || !data) return
      setRegistros(new Map(data.map((r) => [r.num as number, { state: (r.state as ToothState) ?? 'higido', faces: (r.faces as Faces | null) ?? {} }])))
    })
    return () => { cancelled = true }
  }, [patientId])

  // trocar de dentição com um dente que não existe nela: seleciona um que existe
  useEffect(() => { if (!todosNums.includes(selected)) setSelected(todosNums[Math.floor(todosNums.length / 4)]) }, [todosNums, selected])

  const reg = (num: number): Registro => registros.get(num) ?? { state: 'higido', faces: {} }
  const item = (num: number): ToothItem => ({ num, state: resumo(reg(num)) })
  const arches = { upR: layout.upR.map(item), upL: layout.upL.map(item), loR: layout.loR.map(item), loL: layout.loL.map(item) }

  const filterState = CONDITION_FILTERS.find((c) => c.label === chip)?.state ?? null
  const isDim = (t: ToothItem) => filterState !== null && t.state !== filterState

  const allTeeth = [...arches.upR, ...arches.upL, ...arches.loR, ...arches.loL]
  const selReg = reg(selected)
  const selectedState = resumo(selReg)
  const alterados = allTeeth.filter((t) => t.state !== 'higido')
  const chart = useMemo(() => {
    const counts: Record<string, number> = {}
    allTeeth.forEach((t) => { counts[t.state] = (counts[t.state] ?? 0) + 1 })
    const total = allTeeth.length || 1
    return (['cariado', 'restaurado', 'selante', 'erupcao', 'ausente', 'extraido'] as ToothState[])
      .filter((s) => counts[s]).map((s) => ({ label: TOOTH[s].label, pct: Math.round((counts[s] / total) * 100), color: TOOTH[s].marker }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registros, dentView])

  const openEdit = (num = selected) => {
    setSelected(num)
    setRascunho({ state: reg(num).state, faces: { ...reg(num).faces } })
    setEditOpen(true)
  }
  const clicarFace = (f: Face) => setRascunho((r) => {
    const faces = { ...r.faces }
    if (faces[f] === ferramenta) delete faces[f]
    else faces[f] = ferramenta
    // marcar face num dente "ausente/extraído" não faz sentido: volta a presente
    return { state: r.state === 'ausente' || r.state === 'extraido' ? 'higido' : r.state, faces }
  })

  /** Grava um dente; só confirma depois de o banco aceitar (e volta ao que era se recusar). */
  const salvar = async (num: number, novo: Registro) => {
    const limpo: Registro = novo.state === 'ausente' || novo.state === 'extraido' ? { state: novo.state, faces: {} } : novo
    const antes = registros.get(num)
    setRegistros((m) => new Map(m).set(num, limpo))
    if (supabase && patientId) {
      setSalvando(true)
      const row: Record<string, unknown> = { patient_id: patientId, num, state: resumo(limpo) }
      if (esquema.v26) { row.faces = limpo.faces; row.updated_at = new Date().toISOString() }
      const { error } = await supabase.from('teeth').upsert(row, { onConflict: 'patient_id,num' })
      setSalvando(false)
      if (error) {
        setRegistros((m) => { const n = new Map(m); if (antes) n.set(num, antes); else n.delete(num); return n })
        return toast(`Não foi possível salvar o dente ${num}: ${error.message}`, 'error')
      }
      if (!esquema.v26 && Object.keys(limpo.faces).length) toast('As faces ficam guardadas depois da migração 0026; por ora vale a condição do dente.', 'info')
    }
    setEditOpen(false)
    const det = textoFaces(num, limpo.faces)
    toast(`Dente ${num}: ${det || TOOTH[resumo(limpo)].label}.`)
  }

  const upperOf = (num: number) => [1, 2, 5, 6].includes(Math.floor(num / 10))

  // impressão: o documento "Odontograma" com o layout que está na tela e as faces anotadas
  const docOdonto = DOCUMENTS.find((d) => d.key === (dentView === 'Permanente' ? 'odonto_perm' : 'odonto'))!
  const ctxImpressao = {
    patientName: patient?.name, birthdate: patient?.birthdate, demo,
    teeth: allTeeth.map((t) => ({ num: t.num, state: t.state, faces: textoFaces(t.num, reg(t.num).faces) })),
    dentLayout: { titulo: `Dentição ${dentView.toLowerCase()}`, sup: [...layout.upR, ...layout.upL].map(String), inf: [...layout.loR, ...layout.loL].map(String) },
  }

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
            <button className="btn-soft" onClick={() => setImprimindo(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="print" size={15} /> Imprimir
            </button>
          </div>

          <section className="panel" aria-labelledby="odonto-titulo">
            <div className="panel-head" style={{ marginBottom: 14 }}>
              <h2 id="odonto-titulo" className="panel-title">
                Odontograma <span style={{ font: '400 12.5px var(--font)', color: 'var(--muted)' }}>dentição {dentView.toLowerCase()} · {todosNums.length} dentes{patient?.age ? ` · ${patient.age}` : ''}</span>
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
                <Odonto3D key={dentView} upper={[...arches.upR, ...arches.upL]} lower={[...arches.loR, ...arches.loL]} selected={selected} onSelect={setSelected} isDim={isDim} />
              </Suspense>
            ) : (<>
              <div className="arch-label">MAXILA</div>
              <div className={`arch-gum${todosNums.length > 24 ? ' dense' : ''}`}>
                {arches.upR.map((t) => <AnatomicalTooth key={t.num} tooth={t} upper selected={t.num === selected} dim={isDim(t)} onClick={setSelected} />)}
                <span className="arch-gap" />
                {arches.upL.map((t) => <AnatomicalTooth key={t.num} tooth={t} upper selected={t.num === selected} dim={isDim(t)} onClick={setSelected} />)}
              </div>
              <div style={{ height: 12 }} />
              <div className={`arch-gum lower${todosNums.length > 24 ? ' dense' : ''}`}>
                {arches.loR.map((t) => <AnatomicalTooth key={t.num} tooth={t} upper={false} selected={t.num === selected} dim={isDim(t)} onClick={setSelected} />)}
                <span className="arch-gap" />
                {arches.loL.map((t) => <AnatomicalTooth key={t.num} tooth={t} upper={false} selected={t.num === selected} dim={isDim(t)} onClick={setSelected} />)}
              </div>
              <div className="arch-label" style={{ marginTop: 8 }}>MANDÍBULA</div>
            </>)}

            <div className="cond-legend">
              {LEGEND.map((s) => <div key={s}><ToothBox state={s} size="mini" />{TOOTH[s].label}</div>)}
            </div>
          </section>
        </div>

        <aside className="home-aside wrap-row" aria-label="Dente selecionado">
          <section className="panel">
            <div className="panel-head" style={{ marginBottom: 12 }}>
              <h2 className="panel-title sm">Dente {selected}</h2>
              <Menu items={[{ label: 'Editar condição', onClick: () => openEdit() }, { label: 'Marcar como hígido', onClick: () => void salvar(selected, { state: 'higido', faces: {} }) }]} />
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 10 }}>
              <FaceDiagram num={selected} faces={selReg.faces} size={84} onFace={() => openEdit()} />
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 14px var(--font)', color: 'var(--ink)' }}>{TOOTH_GROUP(selected)} · {DENTITION(selected).toLowerCase()}</div>
                <div style={{ font: '400 12.5px var(--font)', color: 'var(--slate)', marginTop: 3 }}>
                  Condição: <b style={{ fontWeight: 600, color: TOOTH[selectedState].fg }}>{TOOTH[selectedState].label}</b>
                </div>
                {Object.keys(selReg.faces).length > 0 && <div style={{ font: '400 12px var(--font)', color: 'var(--muted)', marginTop: 2 }}>{textoFaces(selected, selReg.faces)}</div>}
                <div style={{ font: '400 12px var(--font)', color: 'var(--muted)' }}>{QUADRANT(selected)}</div>
              </div>
            </div>
            <button className="btn-cta" style={{ width: '100%' }} onClick={() => openEdit()}>Editar dente e faces</button>
          </section>

          <section className="panel">
            <h2 className="panel-title sm">Dentes com alteração {alterados.length > 0 && <span style={{ font: '400 12.5px var(--font)', color: 'var(--muted)' }}>{alterados.length}</span>}</h2>
            {alterados.length === 0 ? (
              <p className="empty-note">Nenhuma alteração nesta dentição — todos hígidos.</p>
            ) : (
              <div className="row-list" style={{ marginTop: 6 }}>
                {alterados.map((t) => (
                  <div key={t.num}>
                    <button className="tooth-thumb" onClick={() => setSelected(t.num)} aria-label={`Selecionar dente ${t.num}`} style={{ width: 40, height: 48, border: 'none', cursor: 'pointer', background: TOOTH[t.state].bg }}>
                      <AnatomicalTooth tooth={t} upper={upperOf(t.num)} width={24} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '500 13px var(--font)', color: 'var(--ink)' }}>Dente {t.num} · {TOOTH[t.state].label}</div>
                      <div style={{ font: '400 12px var(--font)', color: 'var(--muted)' }}>{textoFaces(t.num, reg(t.num).faces) || `${TOOTH_GROUP(t.num)} · ${DENTITION(t.num).toLowerCase()}`}</div>
                    </div>
                    <Menu items={[{ label: 'Ver / editar', onClick: () => openEdit(t.num) }]} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="panel" aria-labelledby="cond-titulo" style={{ marginTop: 18 }}>
        <h2 id="cond-titulo" className="panel-title sm">Condições registradas · dentição {dentView.toLowerCase()}</h2>
        {chart.length === 0 ? (
          <p className="empty-note">Sem condições registradas nesta dentição.</p>
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

      {/* prevenção (odontopediatria): risco de cárie, placa, flúor e selantes com reavaliação */}
      {(patient?.perfil ?? 'pediatrico') === 'pediatrico' && <IndicesClinicos />}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Dente ${selected}`} subtitle={`${TOOTH_GROUP(selected)} · ${QUADRANT(selected)}`} width={440}
        footer={<><Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button><Button loading={salvando} onClick={() => void salvar(selected, rascunho)}>Salvar</Button></>}>
        <Field label="Dente inteiro">
          <Select value={rascunho.state} onChange={(e) => setRascunho({ ...rascunho, state: e.target.value as ToothState })}>
            {ESTADOS_DENTE.map((s) => <option key={s} value={s}>{TOOTH[s].label}</option>)}
          </Select>
        </Field>
        {rascunho.state !== 'ausente' && rascunho.state !== 'extraido' && (
          <>
            <div className="face-tools" role="group" aria-label="O que marcar nas faces">
              {ESTADOS_FACE.map((s) => (
                <button key={s} type="button" aria-pressed={ferramenta === s} onClick={() => setFerramenta(s)}>
                  <ToothBox state={s} size="mini" /> {TOOTH[s].label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <FaceDiagram num={selected} faces={rascunho.faces} size={150} onFace={clicarFace} />
              <div style={{ font: '400 12.5px/1.55 var(--font)', color: 'var(--muted)' }}>
                Escolha a condição acima e toque nas faces. Tocar de novo apaga.<br />
                {(['V', 'L', 'M', 'D', 'O'] as Face[]).map((f) => <span key={f} style={{ display: 'block' }}><b>{rotuloFace(f, selected)}</b> {nomeFace(f, selected)}{rascunho.faces[f] ? ` — ${TOOTH[rascunho.faces[f]!].label}` : ''}</span>)}
              </div>
            </div>
          </>
        )}
      </Modal>

      <DocumentViewer open={imprimindo} onClose={() => setImprimindo(false)} docs={[{ key: docOdonto.key, title: docOdonto.title, node: docOdonto.node }]} blank={false} ctx={ctxImpressao} />
    </div>
  )
}
