import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { usePatientId } from '../../lib/useCollection'

interface Zone { id: string; label: string; cx: number; cy: number; rx: number; ry: number; color: string }

// coordenadas num viewBox 200x260 (rosto frontal)
const ZONES: Zone[] = [
  { id: 'testa', label: 'Testa (frontal)', cx: 100, cy: 58, rx: 46, ry: 20, color: '#3f6bf5' },
  { id: 'glabela', label: 'Glabela', cx: 100, cy: 86, rx: 14, ry: 12, color: '#c2478a' },
  { id: 'pgd', label: 'Pés de galinha D', cx: 52, cy: 100, rx: 15, ry: 12, color: '#d97706' },
  { id: 'pge', label: 'Pés de galinha E', cx: 148, cy: 100, rx: 15, ry: 12, color: '#d97706' },
  { id: 'naso', label: 'Sulco nasolabial', cx: 100, cy: 150, rx: 30, ry: 12, color: '#16a34a' },
  { id: 'mento', label: 'Mento', cx: 100, cy: 210, rx: 20, ry: 14, color: '#7c5bc4' },
  { id: 'massd', label: 'Masseter D', cx: 48, cy: 170, rx: 16, ry: 20, color: '#0891b2' },
  { id: 'masse', label: 'Masseter E', cx: 152, cy: 170, rx: 16, ry: 20, color: '#0891b2' },
]

const INITIAL: Record<string, number> = { testa: 10, glabela: 8, pgd: 6, pge: 6, naso: 0, mento: 0, massd: 0, masse: 0 }

export default function MapaFacial() {
  const { toast } = useToast()
  const patientId = usePatientId()
  const [units, setUnits] = useState<Record<string, number>>(INITIAL)
  const [sel, setSel] = useState('testa')
  const total = Object.values(units).reduce((a, b) => a + b, 0)
  const set = (id: string, v: number) => setUnits((u) => ({ ...u, [id]: Math.max(0, v) }))

  useEffect(() => {
    if (!supabase || !patientId) return
    let cancelled = false
    supabase.from('facial_map').select('zone,units').eq('patient_id', patientId).then(({ data, error }) => {
      if (cancelled || error || !data || data.length === 0) return
      setUnits((u) => { const next = { ...u }; data.forEach((r) => { next[r.zone as string] = r.units as number }); return next })
    })
    return () => { cancelled = true }
  }, [patientId])

  const salvar = () => {
    if (supabase && patientId) {
      const rows = ZONES.map((z) => ({ patient_id: patientId, zone: z.id, units: units[z.id] ?? 0 }))
      supabase.from('facial_map').upsert(rows, { onConflict: 'patient_id,zone' }).then(({ error }) => { if (error) console.error('[supabase] facial_map', error.message) })
    }
    toast('Mapa de aplicação salvo.')
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignContent: 'start' }}>
      <div className="card" style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
        <svg viewBox="0 0 200 260" style={{ width: 320, maxWidth: '100%' }}>
          {/* rosto */}
          <ellipse cx="100" cy="130" rx="78" ry="115" fill="#fff" stroke="#e6ccd8" strokeWidth="2" />
          <path d="M70 96c6-5 16-5 22 0M108 96c6-5 16-5 22 0" fill="none" stroke="#d7bcc9" strokeWidth="2" />
          <path d="M92 118v18c0 3 8 3 8 0" fill="none" stroke="#d7bcc9" strokeWidth="2" />
          <path d="M82 168c10 8 26 8 36 0" fill="none" stroke="#d7bcc9" strokeWidth="2" />
          {ZONES.map((z) => {
            const on = units[z.id] > 0
            return (
              <g key={z.id} style={{ cursor: 'pointer' }} onClick={() => setSel(z.id)}>
                <ellipse cx={z.cx} cy={z.cy} rx={z.rx} ry={z.ry} fill={on ? `${z.color}30` : '#f0f2f7'} stroke={z.id === sel ? z.color : on ? z.color : '#d7ddea'} strokeWidth={z.id === sel ? 2.4 : 1.4} strokeDasharray={on ? undefined : '3 3'} />
                {on && <text x={z.cx} y={z.cy + 4} textAnchor="middle" style={{ font: "700 11px 'Plus Jakarta Sans'", fill: z.color }}>{units[z.id]}</text>}
              </g>
            )
          })}
        </svg>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card card-hover" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a' }}>Unidades por região</span>
            <span style={{ font: "800 13px 'Plus Jakarta Sans'", color: '#c2478a', background: '#fdeaf3', padding: '4px 11px', borderRadius: 14 }}>{total}U</span>
          </div>
          {ZONES.map((z) => (
            <div key={z.id} onClick={() => setSel(z.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', borderRadius: 9, cursor: 'pointer', background: z.id === sel ? '#f5f8ff' : 'transparent' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: z.color, flex: 'none' }} />
              <span style={{ flex: 1, font: "700 12px 'Plus Jakarta Sans'", color: '#26324a' }}>{z.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className="chip" onClick={(e) => { e.stopPropagation(); set(z.id, units[z.id] - 2) }} style={{ width: 24, height: 24, borderRadius: 7, border: '1px solid #e5e9f2', background: '#fff', color: '#5b647a', font: '700 14px' }}>−</button>
                <span className="tnum" style={{ width: 30, textAlign: 'center', font: "800 13px 'Plus Jakarta Sans'", color: '#26324a' }}>{units[z.id]}</span>
                <button className="chip" onClick={(e) => { e.stopPropagation(); set(z.id, units[z.id] + 2) }} style={{ width: 24, height: 24, borderRadius: 7, border: '1px solid #e5e9f2', background: '#fff', color: '#5b647a', font: '700 14px' }}>+</button>
              </div>
            </div>
          ))}
        </div>

        <div className="card card-hover" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: "600 12px 'Plus Jakarta Sans'", color: '#5b647a', padding: '4px 0' }}><span>Total de unidades</span><b className="tnum" style={{ color: '#26324a' }}>{total}U</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', font: "600 12px 'Plus Jakarta Sans'", color: '#5b647a', padding: '4px 0' }}><span>Frascos estimados (50U)</span><b className="tnum" style={{ color: '#26324a' }}>{Math.ceil(total / 50) || 0}</b></div>
          <Button size="sm" block style={{ marginTop: 10 }} onClick={salvar}>Salvar mapa</Button>
        </div>
      </div>
    </div>
  )
}
