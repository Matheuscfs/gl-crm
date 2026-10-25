import { useState } from 'react'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Field, FieldRow, TextInput, Textarea } from '../../components/Field'
import { DateField } from '../../components/DateField'
import { useToast } from '../../components/Toast'
import { useCollection, usePatient } from '../../lib/useCollection'
import { esquema } from '../../lib/sync'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../store'
import { addMonths, brDate, todayISO } from '../../lib/dates'

type Risco = 'baixo' | 'moderado' | 'alto'
interface Indice {
  id: string
  data: string
  risco: Risco | ''
  placa: number | null
  fluor: boolean
  selantes: string[]
  reavaliar: string
  obs: string
}

const RISCOS: { v: Risco; label: string; meses: number; dica: string; cls: string }[] = [
  { v: 'baixo', label: 'Baixo', meses: 12, dica: 'sem lesões ativas, boa higiene, dieta com pouco açúcar', cls: 'ok' },
  { v: 'moderado', label: 'Moderado', meses: 6, dica: 'mancha branca ou placa visível, açúcar frequente', cls: 'warn' },
  { v: 'alto', label: 'Alto', meses: 3, dica: 'lesões ativas, cárie nos últimos 12 meses, mamadeira noturna', cls: 'danger' },
]

/**
 * Prevenção em odontopediatria: risco de cárie, índice de placa (O'Leary), flúor e selantes,
 * com data de reavaliação pelo risco (alto 3 meses, moderado 6, baixo 12). A reavaliação
 * vira o "próximo retorno" do paciente — e entra no lembrete de retorno automaticamente.
 */
export default function IndicesClinicos() {
  const { toast } = useToast()
  const { patient, patientId } = usePatient()
  const { updatePatient } = useStore()
  const { rows, add } = useCollection<Indice>(
    'indices_clinicos',
    esquema.v26 ? patientId : null,
    (r) => ({
      id: r.id as string, data: (r.avaliado_em as string) ?? '', risco: (r.risco_carie as Risco) ?? '', placa: r.indice_placa == null ? null : Number(r.indice_placa),
      fluor: !!r.fluor, selantes: (r.selantes as string[]) ?? [], reavaliar: (r.reavaliar_em as string) ?? '', obs: (r.observacoes as string) ?? '',
    }),
    (i) => ({ avaliado_em: i.data, risco_carie: i.risco || null, indice_placa: i.placa, fluor: i.fluor, selantes: i.selantes, reavaliar_em: i.reavaliar || null, observacoes: i.obs || null }),
    [],
  )
  const historico = [...rows].sort((a, b) => b.data.localeCompare(a.data))
  const ultima = historico[0]

  const [aberto, setAberto] = useState(false)
  const novo = () => ({ data: todayISO(), risco: '' as Risco | '', facesPlaca: '', dentes: '', placaDireta: '', fluor: false, selantes: '', reavaliar: '', reavaliarManual: false, obs: '', atualizarRetorno: true })
  const [f, setF] = useState(novo)
  const placaCalc = (() => {
    const faces = Number(f.facesPlaca), dentes = Number(f.dentes)
    if (faces >= 0 && dentes > 0 && f.facesPlaca !== '') return Math.min(100, Math.round((faces / (dentes * 4)) * 1000) / 10)
    const d = Number(f.placaDireta.replace(',', '.'))
    return f.placaDireta !== '' && d >= 0 && d <= 100 ? d : null
  })()
  const escolherRisco = (r: Risco) => setF((x) => ({
    ...x, risco: r,
    // a data de reavaliação acompanha o risco, a não ser que tenha sido escolhida à mão
    reavaliar: x.reavaliarManual ? x.reavaliar : addMonths(x.data, RISCOS.find((y) => y.v === r)!.meses),
  }))

  const salvar = async () => {
    if (!f.risco) return toast('Escolha o risco de cárie.', 'error')
    if (supabase && !esquema.v26) return toast('Os índices clínicos são gravados depois da migração 0026.', 'error')
    const selantes = f.selantes.split(/[^\d]+/).filter((n) => /^[1-8][1-8]$/.test(n))
    const ok = await add({ data: f.data, risco: f.risco, placa: placaCalc, fluor: f.fluor, selantes, reavaliar: f.reavaliar, obs: f.obs.trim() })
    if (!ok) return
    if (f.atualizarRetorno && f.reavaliar && patient) await updatePatient(patient._id, { next: brDate(f.reavaliar) })
    setAberto(false)
    toast(`Avaliação registrada${f.reavaliar ? ` · reavaliar em ${brDate(f.reavaliar)}` : ''}.`)
  }

  const riscoInfo = (r?: string) => RISCOS.find((x) => x.v === r)

  return (
    <section className="panel" aria-labelledby="indices-titulo" style={{ marginTop: 18 }}>
      <div className="panel-head">
        <h2 id="indices-titulo" className="panel-title sm">Prevenção e risco de cárie</h2>
        <Button size="sm" onClick={() => { setF(novo()); setAberto(true) }}>Nova avaliação</Button>
      </div>
      {!ultima ? (
        <p className="empty-note">Nenhuma avaliação registrada. Registre o risco de cárie e a placa para definir o intervalo de retorno.</p>
      ) : (
        <>
          <div className="indices-resumo">
            <div><span>Risco de cárie</span><b className={`tag tag-${riscoInfo(ultima.risco)?.cls === 'ok' ? 'ok' : riscoInfo(ultima.risco)?.cls === 'warn' ? 'warn' : 'danger'}`}>{riscoInfo(ultima.risco)?.label ?? '—'}</b></div>
            <div><span>Índice de placa</span><b>{ultima.placa == null ? '—' : `${String(ultima.placa).replace('.', ',')}%`}</b></div>
            <div><span>Flúor</span><b>{ultima.fluor ? 'aplicado' : 'não'}</b></div>
            <div><span>Selantes</span><b>{ultima.selantes.length ? ultima.selantes.join(', ') : '—'}</b></div>
            <div><span>Reavaliar em</span><b>{ultima.reavaliar ? brDate(ultima.reavaliar) : '—'}</b></div>
          </div>
          {historico.length > 1 && (
            <div className="row-list" style={{ marginTop: 10 }}>
              {historico.slice(1, 6).map((i) => (
                <div key={i.id} style={{ display: 'block', font: '400 12.5px var(--font)', color: 'var(--text-2)' }}>
                  {brDate(i.data)} · risco {riscoInfo(i.risco)?.label.toLowerCase() ?? '—'} · placa {i.placa == null ? '—' : `${i.placa}%`}{i.fluor ? ' · flúor' : ''}{i.selantes.length ? ` · selantes ${i.selantes.join(', ')}` : ''}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={aberto} onClose={() => setAberto(false)} title="Nova avaliação" subtitle={patient?.name ?? ''} width={480}
        footer={<><Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button><Button onClick={() => void salvar()}>Registrar</Button></>}>
        <Field label="Data"><DateField value={f.data} onChange={(iso) => setF({ ...f, data: iso })} /></Field>
        <Field label="Risco de cárie">
          <div className="seg-sm" role="group" aria-label="Risco de cárie" style={{ width: 'fit-content' }}>
            {RISCOS.map((r) => <button key={r.v} type="button" aria-pressed={f.risco === r.v} onClick={() => escolherRisco(r.v)}>{r.label}</button>)}
          </div>
          {f.risco && <span style={{ font: '400 12px var(--font)', color: 'var(--muted)', marginTop: 4 }}>{riscoInfo(f.risco)?.dica}</span>}
        </Field>
        <FieldRow>
          <Field label="Faces com placa"><TextInput inputMode="numeric" value={f.facesPlaca} onChange={(e) => setF({ ...f, facesPlaca: e.target.value.replace(/\D/g, '') })} placeholder="Ex.: 18" /></Field>
          <Field label="Dentes presentes"><TextInput inputMode="numeric" value={f.dentes} onChange={(e) => setF({ ...f, dentes: e.target.value.replace(/\D/g, '') })} placeholder="Ex.: 20" /></Field>
        </FieldRow>
        <div style={{ font: '400 12.5px var(--font)', color: 'var(--text-2)' }}>
          Índice de placa (O'Leary): <b>{placaCalc == null ? '—' : `${String(placaCalc).replace('.', ',')}%`}</b>
          {f.facesPlaca === '' && <> · ou informe direto: <input className="field-input" style={{ width: 70, height: 30, display: 'inline-block' }} inputMode="decimal" value={f.placaDireta} onChange={(e) => setF({ ...f, placaDireta: e.target.value })} aria-label="Índice de placa em %" /> %</>}
        </div>
        <label className="check-line"><input type="checkbox" checked={f.fluor} onChange={(e) => setF({ ...f, fluor: e.target.checked })} /> Aplicação tópica de flúor nesta sessão</label>
        <Field label="Selantes aplicados (dentes)"><TextInput value={f.selantes} onChange={(e) => setF({ ...f, selantes: e.target.value })} placeholder="Ex.: 16, 26, 36, 46" /></Field>
        <Field label="Reavaliar em"><DateField value={f.reavaliar} onChange={(iso) => setF({ ...f, reavaliar: iso, reavaliarManual: true })} /></Field>
        <label className="check-line"><input type="checkbox" checked={f.atualizarRetorno} onChange={(e) => setF({ ...f, atualizarRetorno: e.target.checked })} /> Usar como próximo retorno do paciente (entra no lembrete)</label>
        <Field label="Observações (opcional)"><Textarea rows={2} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></Field>
      </Modal>
    </section>
  )
}
