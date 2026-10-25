import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Modal } from '../../components/Modal'
import { Field, TextInput } from '../../components/Field'
import { useToast } from '../../components/Toast'
import { useCollection, usePatient } from '../../lib/useCollection'
import { supabase } from '../../lib/supabase'
import { uploadPatientPhoto } from '../../lib/storage'
import { useGoogle } from '../../lib/GoogleProvider'
import { uploadToDrive } from '../../lib/googleDrive'
import { brDate, todayISO } from '../../lib/dates'
import { SimulationEditor } from './SimulationEditor'
import { PatientPhoto } from '../../components/PatientPhoto'

type Slot = 'before' | 'after'
type PhotoMap = Record<string, { before?: string; after?: string }>

const ANGLES = ['Frontal', 'Perfil D', 'Perfil E', 'Sorriso']
const REGIONS = ['Testa', 'Glabela', 'Pés de galinha', 'Preenchimento']
const REGION_COLOR: Record<string, string> = { Testa: 'var(--primary)', Glabela: 'var(--brand-pink)', 'Pés de galinha': '#d97706', Preenchimento: '#16a34a' }

interface Marker { id: string; x: number; y: number; region: string; units: number; angle: string }
interface Session { id: string; date: string; label: string }

const SEED_SESSIONS: Session[] = [
  { id: 's1', date: '2026-06-10', label: 'Avaliação inicial' },
  { id: 's2', date: '2026-06-24', label: 'Aplicação — 20U' },
  { id: 's3', date: '2026-07-08', label: 'Retorno 15 dias' },
]

/** Data da sessão em ISO para ordenar (aceita o "dd/mm/aaaa" de registros antigos). */
const isoSessao = (d: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d); return m ? `${m[3]}-${m[2]}-${m[1]}` : d }
const dataSessao = (d: string) => brDate(isoSessao(d)) || d

/** Ilustração em traço fino, por ângulo, enquanto não há foto enviada. */
function FacePlaceholder({ label }: { label: string }) {
  const perfil = /Perfil/.test(label)
  const espelho = /Perfil E/.test(label)
  const sorriso = /Sorriso/.test(label)
  return (
    <div className="ph-face">
      <svg viewBox="0 0 200 240" aria-hidden="true" style={espelho ? { transform: 'scaleX(-1)' } : undefined}>
        {sorriso ? (
          <g>
            <path className="pf-soft" d="M30 120c20-34 52-44 70-38 18-6 50 4 70 38-20 42-52 58-70 58s-50-16-70-58z" />
            <path d="M30 120c20-34 52-44 70-38 18-6 50 4 70 38" />
            <path d="M30 120c20 42 52 58 70 58s50-16 70-58" />
            <path d="M44 120c18 8 38 12 56 12s38-4 56-12" />
            <path d="M56 121v14M72 125v18M88 128v20M112 128v20M128 125v18M144 121v14" className="pf-thin" />
            <path d="M48 124c16 18 34 26 52 26s36-8 52-26" className="pf-thin" />
          </g>
        ) : perfil ? (
          <g>
            <path className="pf-soft" d="M118 26c34 0 54 28 52 62-2 28-16 44-30 52v64H96v-26c-10-2-18-8-22-18-6-2-8-6-6-10-4-2-4-6-2-8-4-2-6-6-2-10l8-14c0-8 0-14 2-22 4-40 28-70 44-70z" />
            <path d="M118 26c34 0 54 28 52 62-2 28-16 44-30 52v64" />
            <path d="M118 26c-16 0-40 30-44 70-2 8-2 14-2 22l-8 14c-4 4-2 8 2 10-2 2-2 6 2 8-2 4 0 8 6 10 4 10 12 16 22 18v26" />
            <path d="M84 88c6-3 13-3 18 1" className="pf-thin" />
            <path d="M86 98c5 3 11 3 15 0" className="pf-thin" />
            <path d="M74 134c4 1 8 0 10-2" className="pf-thin" />
            <path d="M140 92c6 4 8 12 4 18" className="pf-thin" />
            <path d="M96 204c-14 4-34 12-44 36M140 204c16 6 30 14 38 36" />
          </g>
        ) : (
          <g>
            <path className="pf-soft" d="M100 30c-36 0-52 30-50 68 2 36 18 70 50 80 32-10 48-44 50-80 2-38-14-68-50-68z" />
            <path d="M100 30c-36 0-52 30-50 68 2 36 18 70 50 80 32-10 48-44 50-80 2-38-14-68-50-68z" />
            <path d="M50 92c-2-40 22-64 50-64s52 24 50 64c-6-24-24-40-50-40S56 68 50 92z" className="pf-hair" />
            <path d="M72 92c8-6 16-6 22-2M106 90c6-4 14-4 22 2" className="pf-thin" />
            <path d="M74 104c6 4 12 4 18 0M108 104c6 4 12 4 18 0" className="pf-thin" />
            <path d="M100 104c-1 12-4 20-6 25 4 3 8 3 12 0" className="pf-thin" />
            <path d="M88 148c6-4 9-3 12-2 3-1 6-2 12 2-6 6-18 6-24 0z" className="pf-thin" />
            <path d="M84 174v26M116 174v26M84 200c-22 6-42 14-52 40M116 200c22 6 42 14 52 40" />
          </g>
        )}
      </svg>
      <span>{label}</span>
    </div>
  )
}

function GuideOverlay() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#5b2196" strokeWidth="1" strokeDasharray="5 5" opacity="0.5" />
      <line x1="0" y1="33%" x2="100%" y2="33%" stroke="#5b2196" strokeWidth="1" strokeDasharray="5 5" opacity="0.35" />
      <line x1="0" y1="66%" x2="100%" y2="66%" stroke="#5b2196" strokeWidth="1" strokeDasharray="5 5" opacity="0.35" />
    </svg>
  )
}

export default function AntesDepois() {
  const { toast } = useToast()
  const { patient: atual, patientId, demo: isDemo } = usePatient()
  // sessões gravadas em photo_sessions; as de demonstração só aparecem em paciente fictício
  const { rows: sessoesSalvas, add: addSessao, save: saveSessao, remove: removeSessao } = useCollection<Session>(
    'photo_sessions',
    patientId,
    (r) => ({ id: r.id as string, date: (r.session_date as string) ?? '', label: (r.label as string) ?? '' }),
    (s) => ({ session_date: s.date, label: s.label }),
    isDemo ? SEED_SESSIONS : [],
  )
  const sessions = [...sessoesSalvas].sort((a, b) => isoSessao(a.date).localeCompare(isoSessao(b.date)))
  const [activeSession, setActiveSession] = useState('')
  // sem escolha, fica marcada a mais recente
  const sessaoAtiva = sessions.find((s) => s.id === activeSession) ?? sessions[sessions.length - 1] ?? null
  const [editSessao, setEditSessao] = useState<Session | null>(null)
  const [excluirSessao, setExcluirSessao] = useState<Session | null>(null)
  const salvarSessao = async () => {
    if (!editSessao) return
    const item = { date: editSessao.date || todayISO(), label: editSessao.label.trim() || 'Sessão' }
    if (!editSessao.id) {
      const ok = await addSessao(item)
      if (ok) { setActiveSession(''); toast('Sessão criada.') } else toast('Não foi possível criar a sessão.', 'error')
    } else {
      const ok = await saveSessao({ id: editSessao.id, ...item })
      toast(ok ? 'Sessão atualizada.' : 'Não foi possível salvar a sessão.', ok ? 'success' : 'error')
    }
    setEditSessao(null)
  }
  const [angle, setAngle] = useState('Frontal')
  const [guide, setGuide] = useState(true)
  const [mode, setMode] = useState<'lado' | 'slider'>('lado')
  const [slider, setSlider] = useState(50)
  const [photos, setPhotos] = useState<PhotoMap>({})
  const [uploading, setUploading] = useState(false)
  const [markMode, setMarkMode] = useState(false)
  const [region, setRegion] = useState(REGIONS[0])
  const [units, setUnits] = useState(4)
  const google = useGoogle()
  const patientName = atual?.name ?? 'Paciente'
  const { rows: markers, add: addMk, remove: removeMk } = useCollection<Marker>(
    'aesthetic_markers',
    patientId,
    (r) => ({ id: r.id as string, region: (r.region as string) ?? '', units: (r.units as number) ?? 0, x: Number(r.x), y: Number(r.y), angle: (r.angle as string) ?? 'Frontal' }),
    (m) => ({ region: m.region, units: m.units, x: m.x, y: m.y, angle: m.angle }),
    [],
  )
  const [sim] = useState({ Testa: 0, Glabela: 0, 'Pés de galinha': 0, Preenchimento: 0 } as Record<string, number>)
  const [showSim] = useState(false)
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
  const [confirmLimpar, setConfirmLimpar] = useState(false)
  const clearMarkers = () => setConfirmLimpar(true)
  const limparDeVez = async () => {
    const oks = await Promise.all(markers.map((m) => removeMk(m.id)))
    if (oks.every(Boolean)) toast('Marcadores removidos.')
  }

  const totalUnits = markers.reduce((s, m) => s + m.units, 0)
  const simAvg = Object.values(sim).reduce((a, b) => a + b, 0) / 4
  const simFilter = showSim ? `blur(${(simAvg / 100) * 0.7}px) brightness(${1 + (simAvg / 100) * 0.05}) contrast(${1 - (simAvg / 100) * 0.05})` : 'none'

  const Photo = ({ src, label }: { src: string | null; label: string }) => (
    <PatientPhoto
      src={src ?? undefined}
      alt={label}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      fallback={<FacePlaceholder label={label} />}
    />
  )

  return (
    <div className="tab-body">
      <div className="home-cols">
      {/* Coluna principal */}
      <div className="home-main" style={{ gap: 14 }}>
        {/* controles topo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div className="seg">
            {ANGLES.map((a) => <button key={a} className={`seg-item${a === angle ? ' active' : ''}`} onClick={() => setAngle(a)}>{a}</button>)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className="chip" onClick={() => setGuide((g) => !g)} style={{ height: 34, padding: '0 12px', borderRadius: 9, border: `1px solid ${guide ? 'var(--primary-border)' : 'var(--border-strong)'}`, background: guide ? 'var(--primary-bg)' : 'var(--surface)', color: guide ? 'var(--primary-dark)' : 'var(--slate)', font: "700 12px var(--font)" }}>Guia de enquadramento</button>
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
              <div style={{ font: "700 11px var(--font)", color: 'var(--muted)', marginBottom: 6, textAlign: 'center', letterSpacing: '.05em' }}>ANTES</div>
              <div onClick={addMarker} style={{ position: 'relative', aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', cursor: markMode ? 'crosshair' : 'default' }}>
                <div style={{ position: 'absolute', inset: 0, filter: simFilter }}><Photo src={before} label={`Antes · ${angle}`} /></div>
                {showSim && Object.entries(sim).map(([reg, val]) => val > 0 && (
                  <div key={reg} style={{ position: 'absolute', left: reg === 'Glabela' ? '42%' : reg === 'Testa' ? '30%' : reg === 'Pés de galinha' ? '18%' : '38%', top: reg === 'Preenchimento' ? '58%' : reg === 'Pés de galinha' ? '38%' : '22%', width: reg === 'Testa' ? '40%' : '24%', height: '14%', borderRadius: '50%', background: REGION_COLOR[reg], opacity: (val / 100) * 0.25, filter: 'blur(6px)' }} />
                ))}
                {guide && <GuideOverlay />}
                {markers.map((m) => (
                  <div key={m.id} title={`${m.region} · ${m.units}U`} style={{ position: 'absolute', left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%,-50%)', width: 22, height: 22, borderRadius: '50%', background: REGION_COLOR[m.region], color: '#fff', font: "800 9px var(--font)", display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }}>{m.units}</div>
                ))}
                {showSim && <div style={{ position: 'absolute', left: 8, bottom: 8, right: 8, font: "700 9.5px var(--font)", color: '#fff', background: 'rgba(194,71,138,.85)', padding: '4px 8px', borderRadius: 7, textAlign: 'center' }}>Simulação — não constitui garantia de resultado</div>}
              </div>
            </div>
            <div>
              <div style={{ font: "700 11px var(--font)", color: 'var(--muted)', marginBottom: 6, textAlign: 'center', letterSpacing: '.05em' }}>DEPOIS</div>
              <div style={{ position: 'relative', aspectRatio: '3/4', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
                <Photo src={after} label={`Depois · ${angle}`} />
                {guide && <GuideOverlay />}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ width: 'min(100%, 620px)', margin: '0 auto' }}>
            <div className="cmp-frame"
              onPointerDown={(e) => { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); const r = e.currentTarget.getBoundingClientRect(); setSlider(Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)))) }}
              onPointerMove={(e) => { if (!(e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)) return; const r = e.currentTarget.getBoundingClientRect(); setSlider(Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)))) }}>
              <Photo src={after} label={`Depois · ${angle}`} />
              <div style={{ position: 'absolute', inset: 0, width: `${slider}%`, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${10000 / Math.max(slider, 1)}%` }}><Photo src={before} label={`Antes · ${angle}`} /></div>
              </div>
              {guide && <GuideOverlay />}
              <div className="cmp-handle" style={{ left: `${slider}%` }} role="slider" tabIndex={0} aria-label="Comparar antes e depois" aria-valuemin={0} aria-valuemax={100} aria-valuenow={slider}
                onKeyDown={(e) => { if (e.key === 'ArrowLeft') setSlider((v) => Math.max(0, v - 5)); if (e.key === 'ArrowRight') setSlider((v) => Math.min(100, v + 5)) }}>
                <span aria-hidden="true">‹ ›</span>
              </div>
              <div style={{ position: 'absolute', top: 8, left: 10, font: "800 10px var(--font)", color: '#fff', background: 'rgba(0,0,0,.4)', padding: '2px 8px', borderRadius: 12 }}>ANTES</div>
              <div style={{ position: 'absolute', top: 8, right: 10, font: "800 10px var(--font)", color: '#fff', background: 'rgba(0,0,0,.4)', padding: '2px 8px', borderRadius: 12 }}>DEPOIS</div>
            </div>
            <p className="o3d-hint">Arraste a alça (ou use as setas do teclado) para comparar</p>
          </div>
        )}

        {/* galeria de sessões */}
        <div>
          <h2 className="panel-title sm" style={{ margin: '4px 0 8px' }}>Sessões fotográficas</h2>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {sessions.map((s) => (
              <button key={s.id} className="card-hover" onClick={() => setActiveSession(s.id)} aria-pressed={s.id === sessaoAtiva?.id} style={{ flex: 'none', width: 130, textAlign: 'left', padding: 8, borderRadius: 12, border: `1.5px solid ${s.id === sessaoAtiva?.id ? 'var(--primary)' : 'var(--line)'}`, background: 'var(--surface)', cursor: 'pointer' }}>
                <div style={{ aspectRatio: '1/1', borderRadius: 8, background: 'linear-gradient(160deg,var(--chip-bg),var(--chip-bg))', marginBottom: 6, position: 'relative', overflow: 'hidden' }}><FacePlaceholder label="" /></div>
                <div style={{ font: "700 11px var(--font)", color: 'var(--ink)' }}>{dataSessao(s.date)}</div>
                <div style={{ font: "600 10px var(--font)", color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
              </button>
            ))}
            <button className="card-hover" onClick={() => setEditSessao({ id: '', date: todayISO(), label: sessions.length ? 'Retorno' : 'Avaliação inicial' })} style={{ flex: 'none', width: 130, borderRadius: 12, border: '1.5px dashed var(--primary-border)', background: 'var(--bg-soft)', color: 'var(--primary-dark)', font: "700 12px var(--font)", cursor: 'pointer' }}>+ Nova sessão</button>
          </div>
          {sessaoAtiva && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, font: '500 12px var(--font)', color: 'var(--muted)' }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dataSessao(sessaoAtiva.date)} · {sessaoAtiva.label}</span>
              <Button variant="ghost" size="sm" onClick={() => setEditSessao({ ...sessaoAtiva, date: isoSessao(sessaoAtiva.date) })}>Editar</Button>
              <Button variant="ghost" size="sm" onClick={() => setExcluirSessao(sessaoAtiva)}>Excluir</Button>
            </div>
          )}
        </div>
      </div>

      <Modal open={!!editSessao} onClose={() => setEditSessao(null)} title={editSessao?.id ? 'Editar sessão' : 'Nova sessão fotográfica'} width={400}
        footer={<><Button variant="outline" onClick={() => setEditSessao(null)}>Cancelar</Button><Button onClick={() => void salvarSessao()}>{editSessao?.id ? 'Salvar' : 'Criar sessão'}</Button></>}>
        {editSessao && <>
          <Field label="Data"><TextInput type="date" value={editSessao.date} onChange={(e) => setEditSessao({ ...editSessao, date: e.target.value })} /></Field>
          <Field label="Descrição"><TextInput value={editSessao.label} onChange={(e) => setEditSessao({ ...editSessao, label: e.target.value })} placeholder="Ex.: Aplicação — 20U" /></Field>
        </>}
      </Modal>
      <ConfirmDialog open={!!excluirSessao} onClose={() => setExcluirSessao(null)}
        onConfirm={() => { const s = excluirSessao; if (s) void removeSessao(s.id).then((ok) => toast(ok ? 'Sessão excluída.' : 'Não foi possível excluir a sessão.', ok ? 'success' : 'error')) }}
        title="Excluir sessão" message={`A sessão de ${excluirSessao ? dataSessao(excluirSessao.date) : ''} sai da lista. As fotos enviadas continuam na ficha.`} confirmLabel="Excluir" />

      {/* Painel lateral */}
      <aside className="home-aside wrap-row" style={{ gap: 14 }}>
        <div className="panel">
          <h2 className="panel-title sm" style={{ marginBottom: 10 }}>Fotos</h2>
          <input ref={beforeInput} type="file" accept="image/*" hidden onChange={pick('before')} />
          <input ref={afterInput} type="file" accept="image/*" hidden onChange={pick('after')} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm" block loading={uploading} onClick={() => beforeInput.current?.click()}>Enviar "antes"</Button>
            <Button variant="outline" size="sm" block loading={uploading} onClick={() => afterInput.current?.click()}>Enviar "depois"</Button>
          </div>
        </div>

        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h2 className="panel-title sm">Aplicação</h2>
            <span style={{ font: "800 12px var(--font)", color: 'var(--brand-pink)', background: 'var(--brand-pink-bg)', padding: '3px 9px', borderRadius: 12 }}>{totalUnits}U total</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select className="field-select" value={region} onChange={(e) => setRegion(e.target.value)} style={{ flex: 1 }}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
            <input className="field-input" type="number" value={units} onChange={(e) => setUnits(Number(e.target.value))} style={{ width: 64 }} />
          </div>
          <Button size="sm" block variant={markMode ? 'primary' : 'teal-soft'} onClick={() => setMarkMode((v) => !v)}>{markMode ? 'Clique na foto para marcar…' : 'Adicionar marcador'}</Button>
          {markers.length > 0 && <button className="chip" onClick={clearMarkers} style={{ marginTop: 8, font: "700 11px var(--font)", color: 'var(--danger-text)', background: 'transparent' }}>Limpar marcadores</button>}
        </div>

        <div className="panel">
          <h2 className="panel-title sm" style={{ marginBottom: 4 }}>Editor de projeção</h2>
          <div style={{ font: "600 11px/1.5 var(--font)", color: 'var(--muted)', marginBottom: 12 }}>Edite a foto "antes" com pincéis reais — suavizar rugas, clarear, dar volume — e salve como projeção ("depois").</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <span className="pill" style={{ background: 'var(--primary-bg)', color: 'var(--primary-dark)' }}>Suavizar</span>
            <span className="pill" style={{ background: 'var(--amber-bg)', color: 'var(--amber-dark)' }}>Clarear</span>
            <span className="pill" style={{ background: 'var(--brand-pink-bg)', color: 'var(--brand-pink)' }}>Volume</span>
          </div>
          <Button size="sm" block disabled={!before} onClick={() => before && setEditorOpen(true)}>{before ? 'Abrir editor de projeção' : 'Envie a foto "antes" primeiro'}</Button>
          <div style={{ font: "700 10px var(--font)", color: 'var(--brand-pink)', textAlign: 'center', marginTop: 8 }}>Simulação — não constitui garantia de resultado</div>
        </div>
      </aside>
      </div>

      {editorOpen && before && <SimulationEditor src={before} onClose={() => setEditorOpen(false)} onSave={onSaveProjection} />}

      <ConfirmDialog open={confirmLimpar} onClose={() => setConfirmLimpar(false)} confirmLabel="Limpar"
        onConfirm={() => void limparDeVez()} title="Limpar marcadores" message={`Remover os ${markers.length} marcadores de aplicação desta foto?`} />
    </div>
  )
}
