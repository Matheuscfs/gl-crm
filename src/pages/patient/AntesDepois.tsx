import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { useToast } from '../../components/Toast'
import { useParams } from 'react-router-dom'
import { useCollection, usePatientId } from '../../lib/useCollection'
import { supabase } from '../../lib/supabase'
import { uploadPatientPhoto } from '../../lib/storage'
import { useGoogle } from '../../lib/GoogleProvider'
import { uploadToDrive } from '../../lib/googleDrive'
import { useStore } from '../../store'
import { isSeedPatient } from '../../data'
import { SimulationEditor } from './SimulationEditor'

type Slot = 'before' | 'after'
type PhotoMap = Record<string, { before?: string; after?: string }>

const ANGLES = ['Frontal', 'Perfil D', 'Perfil E', 'Sorriso']
const REGIONS = ['Testa', 'Glabela', 'Pés de galinha', 'Preenchimento']
const REGION_COLOR: Record<string, string> = { Testa: '#3f6bf5', Glabela: '#c2478a', 'Pés de galinha': '#d97706', Preenchimento: '#16a34a' }

interface Marker { id: string; x: number; y: number; region: string; units: number; angle: string }
interface Session { id: string; date: string; label: string }

const SEED_SESSIONS: Session[] = [
  { id: 's1', date: '10/06/2026', label: 'Avaliação inicial' },
  { id: 's2', date: '24/06/2026', label: 'Aplicação — 20U' },
  { id: 's3', date: '08/07/2026', label: 'Retorno 15 dias' },
]

/** Placeholder de rosto quando não há foto enviada. */
function FacePlaceholder({ label }: { label: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'linear-gradient(160deg,#f3f5fb,#eef1f9)', color: '#aeb7c8' }}>
      <svg width="86" height="100" viewBox="0 0 86 100" fill="none" stroke="#c7cede" strokeWidth="2">
        <ellipse cx="43" cy="44" rx="30" ry="37" fill="#fff" />
        <path d="M30 40c2-3 8-3 10 0M46 40c2-3 8-3 10 0" />
        <path d="M40 50v9c0 2 6 2 6 0" />
        <path d="M35 68c5 4 11 4 16 0" />
      </svg>
      <span style={{ font: "700 11px 'Plus Jakarta Sans'" }}>{label}</span>
    </div>
  )
}

function GuideOverlay() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#3f6bf5" strokeWidth="1" strokeDasharray="5 5" opacity="0.5" />
      <line x1="0" y1="33%" x2="100%" y2="33%" stroke="#3f6bf5" strokeWidth="1" strokeDasharray="5 5" opacity="0.35" />
      <line x1="0" y1="66%" x2="100%" y2="66%" stroke="#3f6bf5" strokeWidth="1" strokeDasharray="5 5" opacity="0.35" />
    </svg>
  )
}

export default function AntesDepois() {
  const { toast } = useToast()
  const { id } = useParams()
  // sessões demo só para pacientes de demonstração — cadastro novo começa sem sessões
  const isDemo = isSeedPatient(id ? decodeURIComponent(id) : '')
  const [sessions, setSessions] = useState<Session[]>(isDemo ? SEED_SESSIONS : [])
  const [activeSession, setActiveSession] = useState(isDemo ? 's3' : '')
  const [angle, setAngle] = useState('Frontal')
  const [guide, setGuide] = useState(true)
  const [mode, setMode] = useState<'lado' | 'slider'>('lado')
  const [slider, setSlider] = useState(50)
  const [photos, setPhotos] = useState<PhotoMap>({})
  const [uploading, setUploading] = useState(false)
  const [markMode, setMarkMode] = useState(false)
  const [region, setRegion] = useState(REGIONS[0])
  const [units, setUnits] = useState(4)
  const patientId = usePatientId()
  const google = useGoogle()
  const { patients } = useStore()
  const patientName = patients.find((p) => p.name === (id ? decodeURIComponent(id) : ''))?.name ?? 'Paciente'
  const { rows: markers, add: addMk, remove: removeMk } = useCollection<Marker>(
    'aesthetic_markers',
    patientId,
    (r) => ({ id: r.id as string, region: (r.region as string) ?? '', units: (r.units as number) ?? 0, x: Number(r.x), y: Number(r.y), angle: (r.angle as string) ?? 'Frontal' }),
    (m) => ({ region: m.region, units: m.units, x: m.x, y: m.y, angle: m.angle }),
    [],
  )
  const [sim, setSim] = useState({ Testa: 0, Glabela: 0, 'Pés de galinha': 0, Preenchimento: 0 } as Record<string, number>)
  const [showSim, setShowSim] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  const onSaveProjection = async (dataUrl: string) => {
    setPhoto('after', dataUrl)
    setEditorOpen(false)
    toast('Projeção salva como "depois".')
    if (supabase && patientId) {
      try {
        const blob = await (await fetch(dataUrl)).blob()
        const file = new File([blob], `projecao-${angle}.jpg`, { type: 'image/jpeg' })
        const up = await uploadPatientPhoto(patientId, angle, 'after', file)
        if (up) {
          setPhoto('after', up)
          supabase.from('patient_photos').upsert({ patient_id: patientId, angle, slot: 'after', url: up }, { onConflict: 'patient_id,angle,slot' }).then(({ error }) => { if (error) console.error(error.message) })
          if (google.connected) uploadToDrive(patientName, file, `projecao-${angle}.jpg`)
        }
      } catch (e) { console.error('[projecao]', e) }
    }
  }
  const beforeInput = useRef<HTMLInputElement>(null)
  const afterInput = useRef<HTMLInputElement>(null)

  const before = photos[angle]?.before ?? null
  const after = photos[angle]?.after ?? null
  const setPhoto = (slot: Slot, url: string) => setPhotos((p) => ({ ...p, [angle]: { ...p[angle], [slot]: url } }))

  // Carrega URLs já enviadas ao Storage
  useEffect(() => {
    if (!supabase || !patientId) return
    let cancelled = false
    supabase.from('patient_photos').select('angle,slot,url').eq('patient_id', patientId).then(({ data, error }) => {
      if (cancelled || error || !data) return
      const map: PhotoMap = {}
      data.forEach((r) => { map[r.angle as string] = { ...(map[r.angle as string] || {}), [r.slot as Slot]: r.url as string } })
      setPhotos(map)
    })
    return () => { cancelled = true }
  }, [patientId])

  const pick = (slot: Slot) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    let url = URL.createObjectURL(f)
    if (supabase && patientId) {
      setUploading(true)
      const up = await uploadPatientPhoto(patientId, angle, slot, f)
      setUploading(false)
      if (up) {
        url = up
        supabase.from('patient_photos').upsert({ patient_id: patientId, angle, slot, url }, { onConflict: 'patient_id,angle,slot' })
          .then(({ error }) => { if (error) console.error('[supabase] patient_photos', error.message) })
      }
    }
    setPhoto(slot, url)
    toast(slot === 'before' ? 'Foto "antes" enviada.' : 'Foto "depois" enviada.')
    if (google.connected) {
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase()
      uploadToDrive(patientName, f, `${angle}-${slot}.${ext}`).then((r) => { if (r) toast('Foto salva no Google Drive.', 'info') })
    }
  }

  const addMarker = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!markMode) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 100
    const y = ((e.clientY - r.top) / r.height) * 100
    addMk({ x, y, region, units, angle })
    toast(`${units}U em ${region}.`)
  }
  const clearMarkers = () => markers.forEach((m) => removeMk(m.id))

  const totalUnits = markers.reduce((s, m) => s + m.units, 0)
  const simAvg = Object.values(sim).reduce((a, b) => a + b, 0) / 4
  const simFilter = showSim ? `blur(${(simAvg / 100) * 0.7}px) brightness(${1 + (simAvg / 100) * 0.05}) contrast(${1 - (simAvg / 100) * 0.05})` : 'none'

  const Photo = ({ src, label }: { src: string | null; label: string }) => (
    <>
      {src ? <img src={src} alt={label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <FacePlaceholder label={label} />}
    </>
  )

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignContent: 'start' }}>
      {/* Coluna principal */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* controles topo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div className="seg">
            {ANGLES.map((a) => <button key={a} className={`seg-item${a === angle ? ' active' : ''}`} onClick={() => setAngle(a)}>{a}</button>)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="chip" onClick={() => setGuide((g) => !g)} style={{ height: 34, padding: '0 12px', borderRadius: 9, border: `1px solid ${guide ? '#cdd8ff' : '#d7ddea'}`, background: guide ? '#e9eeff' : '#fff', color: guide ? '#2f52e0' : '#5b647a', font: "700 12px 'Plus Jakarta Sans'" }}>Guia de enquadramento</button>
            <div className="seg">
              <button className={`seg-item${mode === 'lado' ? ' active' : ''}`} onClick={() => setMode('lado')}>Lado a lado</button>
              <button className={`seg-item${mode === 'slider' ? ' active' : ''}`} onClick={() => setMode('slider')}>Sobreposição</button>
            </div>
          </div>
        </div>

        {/* área de comparação */}
        {mode === 'lado' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, width: 'min(100%, 700px)', margin: '0 auto' }}>
            <div>
              <div style={{ font: "700 11px 'Plus Jakarta Sans'", color: '#8b93a7', marginBottom: 6, textAlign: 'center', letterSpacing: '.05em' }}>ANTES</div>
              <div onClick={addMarker} style={{ position: 'relative', aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden', border: '1px solid #eceff6', cursor: markMode ? 'crosshair' : 'default' }}>
                <div style={{ position: 'absolute', inset: 0, filter: simFilter }}><Photo src={before} label={`Antes · ${angle}`} /></div>
                {showSim && Object.entries(sim).map(([reg, val]) => val > 0 && (
                  <div key={reg} style={{ position: 'absolute', left: reg === 'Glabela' ? '42%' : reg === 'Testa' ? '30%' : reg === 'Pés de galinha' ? '18%' : '38%', top: reg === 'Preenchimento' ? '58%' : reg === 'Pés de galinha' ? '38%' : '22%', width: reg === 'Testa' ? '40%' : '24%', height: '14%', borderRadius: '50%', background: REGION_COLOR[reg], opacity: (val / 100) * 0.25, filter: 'blur(6px)' }} />
                ))}
                {guide && <GuideOverlay />}
                {markers.map((m) => (
                  <div key={m.id} title={`${m.region} · ${m.units}U`} style={{ position: 'absolute', left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%,-50%)', width: 22, height: 22, borderRadius: '50%', background: REGION_COLOR[m.region], color: '#fff', font: "800 9px 'Plus Jakarta Sans'", display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }}>{m.units}</div>
                ))}
                {showSim && <div style={{ position: 'absolute', left: 8, bottom: 8, right: 8, font: "700 9.5px 'Plus Jakarta Sans'", color: '#fff', background: 'rgba(194,71,138,.85)', padding: '4px 8px', borderRadius: 7, textAlign: 'center' }}>Simulação — não constitui garantia de resultado</div>}
              </div>
            </div>
            <div>
              <div style={{ font: "700 11px 'Plus Jakarta Sans'", color: '#8b93a7', marginBottom: 6, textAlign: 'center', letterSpacing: '.05em' }}>DEPOIS</div>
              <div style={{ position: 'relative', aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden', border: '1px solid #eceff6' }}>
                <Photo src={after} label={`Depois · ${angle}`} />
                {guide && <GuideOverlay />}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ width: 'min(100%, 620px)', margin: '0 auto' }}>
            <div style={{ position: 'relative', aspectRatio: '3/2', borderRadius: 14, overflow: 'hidden', border: '1px solid #eceff6' }}>
              <Photo src={after} label={`Depois · ${angle}`} />
              <div style={{ position: 'absolute', inset: 0, width: `${slider}%`, overflow: 'hidden', borderRight: '2px solid #fff' }}>
                <div style={{ position: 'absolute', inset: 0, width: '100vw' }}><Photo src={before} label={`Antes · ${angle}`} /></div>
              </div>
              {guide && <GuideOverlay />}
              <div style={{ position: 'absolute', top: 8, left: 10, font: "800 10px 'Plus Jakarta Sans'", color: '#fff', background: 'rgba(0,0,0,.4)', padding: '2px 8px', borderRadius: 12 }}>ANTES</div>
              <div style={{ position: 'absolute', top: 8, right: 10, font: "800 10px 'Plus Jakarta Sans'", color: '#fff', background: 'rgba(0,0,0,.4)', padding: '2px 8px', borderRadius: 12 }}>DEPOIS</div>
            </div>
            <input type="range" min={0} max={100} value={slider} onChange={(e) => setSlider(Number(e.target.value))} style={{ width: '100%', marginTop: 12, accentColor: '#3f6bf5' }} />
          </div>
        )}

        {/* galeria de sessões */}
        <div>
          <div style={{ font: "800 13px 'Plus Jakarta Sans'", color: '#26324a', margin: '4px 0 8px' }}>Sessões fotográficas</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {sessions.map((s) => (
              <button key={s.id} className="card-hover" onClick={() => setActiveSession(s.id)} style={{ flex: 'none', width: 130, textAlign: 'left', padding: 8, borderRadius: 12, border: `1.5px solid ${s.id === activeSession ? '#3f6bf5' : '#eceff6'}`, background: '#fff', cursor: 'pointer' }}>
                <div style={{ aspectRatio: '1/1', borderRadius: 8, background: 'linear-gradient(160deg,#f3f5fb,#eef1f9)', marginBottom: 6, position: 'relative', overflow: 'hidden' }}><FacePlaceholder label="" /></div>
                <div style={{ font: "700 11px 'Plus Jakarta Sans'", color: '#26324a' }}>{s.date}</div>
                <div style={{ font: "600 10px 'Plus Jakarta Sans'", color: '#8b93a7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
              </button>
            ))}
            <button className="card-hover" onClick={() => { const id = `s${sessions.length + 1}`; setSessions((p) => [...p, { id, date: '17/07/2026', label: 'Nova sessão' }]); setActiveSession(id); toast('Sessão criada.') }} style={{ flex: 'none', width: 130, borderRadius: 12, border: '1.5px dashed #cdd8ff', background: '#f5f8ff', color: '#2f52e0', font: "700 12px 'Plus Jakarta Sans'", cursor: 'pointer' }}>+ Nova sessão</button>
          </div>
        </div>
      </div>

      {/* Painel lateral */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 10 }}>Fotos</div>
          <input ref={beforeInput} type="file" accept="image/*" hidden onChange={pick('before')} />
          <input ref={afterInput} type="file" accept="image/*" hidden onChange={pick('after')} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm" block loading={uploading} onClick={() => beforeInput.current?.click()}>Enviar "antes"</Button>
            <Button variant="outline" size="sm" block loading={uploading} onClick={() => afterInput.current?.click()}>Enviar "depois"</Button>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a' }}>Aplicação</span>
            <span style={{ font: "800 12px 'Plus Jakarta Sans'", color: '#c2478a', background: '#fdeaf3', padding: '3px 9px', borderRadius: 12 }}>{totalUnits}U total</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select className="field-select" value={region} onChange={(e) => setRegion(e.target.value)} style={{ flex: 1 }}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
            <input className="field-input" type="number" value={units} onChange={(e) => setUnits(Number(e.target.value))} style={{ width: 64 }} />
          </div>
          <Button size="sm" block variant={markMode ? 'primary' : 'teal-soft'} onClick={() => setMarkMode((v) => !v)}>{markMode ? 'Clique na foto para marcar…' : 'Adicionar marcador'}</Button>
          {markers.length > 0 && <button className="chip" onClick={clearMarkers} style={{ marginTop: 8, font: "700 11px 'Plus Jakarta Sans'", color: '#d64b45', background: 'transparent' }}>Limpar marcadores</button>}
        </div>

        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 4 }}>Editor de projeção</div>
          <div style={{ font: "600 11px/1.5 'Plus Jakarta Sans'", color: '#8b93a7', marginBottom: 12 }}>Edite a foto "antes" com pincéis reais — suavizar rugas, clarear, dar volume — e salve como projeção ("depois").</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <span className="pill" style={{ background: '#e9eeff', color: '#2f52e0' }}>Suavizar</span>
            <span className="pill" style={{ background: '#fdf1e2', color: '#9a5a06' }}>Clarear</span>
            <span className="pill" style={{ background: '#fdeaf3', color: '#c2478a' }}>Volume</span>
          </div>
          <Button size="sm" block disabled={!before} onClick={() => before && setEditorOpen(true)}>{before ? 'Abrir editor de projeção' : 'Envie a foto "antes" primeiro'}</Button>
          <div style={{ font: "700 10px 'Plus Jakarta Sans'", color: '#c2478a', textAlign: 'center', marginTop: 8 }}>Simulação — não constitui garantia de resultado</div>
        </div>
      </div>

      {editorOpen && before && <SimulationEditor src={before} onClose={() => setEditorOpen(false)} onSave={onSaveProjection} />}
    </div>
  )
}
