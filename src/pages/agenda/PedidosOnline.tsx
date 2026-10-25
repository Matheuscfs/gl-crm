import { useCallback, useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { esquema } from '../../lib/sync'
import { useStore } from '../../store'
import { findPatientByName, waLink } from '../../lib/whats'
import { brDate } from '../../lib/dates'
import { fmtHour, idadeLabel, perfilToKind } from '../../data'

interface Pedido {
  id: string; responsavel: string; telefone: string; paciente: string; nascimento: string | null
  data_desejada: string; hora_desejada: number; procedimento: string | null; observacao: string | null; created_at: string
}

/** Pedidos de horário feitos pela página pública /agendar (migração 0026). */
export function usePedidosOnline() {
  const { carga } = useStore()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const recarregar = useCallback(() => {
    if (!supabase || !esquema.v26) return
    supabase.from('solicitacoes_agendamento').select('*').eq('status', 'nova').order('created_at')
      .then(({ data }) => setPedidos(((data ?? []) as Pedido[]).map((p) => ({ ...p, hora_desejada: Number(p.hora_desejada) }))))
  }, [])
  useEffect(() => { if (carga === 'pronto') recarregar() }, [carga, recarregar])
  return { pedidos, recarregar }
}

export function PedidosOnline({ open, onClose, pedidos, onMudou }: { open: boolean; onClose: () => void; pedidos: Pedido[]; onMudou: () => void }) {
  const { toast } = useToast()
  const { patients, addAppointment } = useStore()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const link = `${window.location.origin}/agendar`

  const marcar = async (p: Pedido, status: 'agendada' | 'recusada', appointmentId?: string) => {
    if (!supabase) return false
    const { error } = await supabase.from('solicitacoes_agendamento').update({ status, appointment_id: appointmentId ?? null }).eq('id', p.id)
    if (error) { toast(`Não foi possível atualizar o pedido: ${error.message}`, 'error'); return false }
    return true
  }

  const agendar = async (p: Pedido) => {
    setOcupado(p.id)
    const cadastro = findPatientByName(patients, p.paciente)
    const id = await addAppointment(p.data_desejada, {
      start: p.hora_desejada, dur: 1, child: cadastro?.name ?? p.paciente,
      age: cadastro?.age || (p.nascimento ? idadeLabel(p.nascimento) : '—'), proc: p.procedimento || 'Consulta',
      status: 'confirmado', kind: cadastro ? perfilToKind(cadastro.perfil) : 'ped', patientId: cadastro?._id,
    })
    if (id && await marcar(p, 'agendada', id)) {
      toast(`${p.paciente} agendado(a) em ${brDate(p.data_desejada)} às ${fmtHour(p.hora_desejada)}${cadastro ? '' : ' — cadastre o paciente na primeira visita'}.`)
      onMudou()
    }
    setOcupado(null)
  }

  const recusar = async (p: Pedido) => {
    setOcupado(p.id)
    if (await marcar(p, 'recusada')) { toast('Pedido recusado. Avise pelo WhatsApp e ofereça outro horário.', 'info'); onMudou() }
    setOcupado(null)
  }

  const avisar = (p: Pedido) => {
    const msg = `Olá, ${p.responsavel.split(' ')[0]}! Recebemos o pedido de horário para ${p.paciente} em ${brDate(p.data_desejada)} às ${fmtHour(p.hora_desejada)}.`
    const url = waLink(p.telefone, msg)
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <Modal open={open} onClose={onClose} title="Pedidos online" subtitle={pedidos.length ? `${pedidos.length} aguardando` : 'Nenhum pedido aguardando'} width={560}
      footer={<Button variant="outline" onClick={onClose}>Fechar</Button>}>
      <div className="notice" style={{ background: 'var(--fill-2)', borderColor: 'var(--line)' }}>
        <p className="notice-text">Link para pacientes (Instagram, Google, WhatsApp): <b>{link}</b></p>
        <button className="btn-line" onClick={() => { void navigator.clipboard?.writeText(link).then(() => toast('Link copiado.')) }}>Copiar</button>
      </div>
      {!esquema.v26 && <p className="empty-note">O agendamento online começa a funcionar depois da migração 0026.</p>}
      {pedidos.length === 0 && esquema.v26 && <p className="empty-note">Quando alguém pedir um horário pelo link, o pedido aparece aqui.</p>}
      {pedidos.map((p) => (
        <div key={p.id} className="pedido-online">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ font: '600 14px var(--font)', color: 'var(--ink)' }}>{brDate(p.data_desejada)} às {fmtHour(p.hora_desejada)} · {p.paciente}</div>
            <div style={{ font: '400 12.5px var(--font)', color: 'var(--muted)' }}>
              {p.procedimento ?? 'Consulta'} · {p.responsavel} · {p.telefone}{p.nascimento ? ` · nasc. ${brDate(p.nascimento)}` : ''}
            </div>
            {p.observacao && <div style={{ font: '400 12.5px var(--font)', color: 'var(--text-2)', marginTop: 2 }}>“{p.observacao}”</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn-line" onClick={() => avisar(p)}>WhatsApp</button>
            <button className="btn-line danger" disabled={ocupado === p.id} onClick={() => void recusar(p)}>Recusar</button>
            <Button size="sm" loading={ocupado === p.id} onClick={() => void agendar(p)}>Agendar</Button>
          </div>
        </div>
      ))}
    </Modal>
  )
}
