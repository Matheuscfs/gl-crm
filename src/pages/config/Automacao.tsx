import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { Field, FieldRow, Select, TextInput } from '../../components/Field'
import { useToast } from '../../components/Toast'
import { useAutomacao, mensagensRecentes, type AutomacaoConfig, type Mensagem } from '../../lib/automacao'

const TIPOS: Record<string, string> = {
  confirmacao: 'Confirmação', cobranca: 'Cobrança', lembrete_retorno: 'Retorno', retoque: 'Retoque', aniversario: 'Aniversário',
  pos_atendimento: 'Pós-atendimento', estoque: 'Estoque',
}
const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: 'na fila', cls: 'tag-neutral' }, enviada: { label: 'enviada', cls: 'tag-info' }, entregue: { label: 'entregue', cls: 'tag-info' },
  lida: { label: 'lida', cls: 'tag-ok' }, respondida: { label: 'respondida', cls: 'tag-ok' }, falhou: { label: 'falhou', cls: 'tag-danger' }, cancelada: { label: 'cancelada', cls: 'tag-neutral' },
}
const DIAS_REGUA = [-7, -3, -1, 0, 1, 3, 7, 15]
const rotuloDia = (d: number) => (d < 0 ? `${-d} dia${d === -1 ? '' : 's'} antes` : d === 0 ? 'no vencimento' : `${d} dia${d === 1 ? '' : 's'} depois`)
const mascara = (t?: string | null) => (t ? `(${t.slice(2, 4)}) •••• -${t.slice(-4)}` : '—')
const quando = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

export default function Automacao() {
  const { toast } = useToast()
  const auto = useAutomacao()
  const [f, setF] = useState<AutomacaoConfig>(auto.config)
  const [salvando, setSalvando] = useState(false)
  const [msgs, setMsgs] = useState<Mensagem[] | null>(null)
  useEffect(() => { setF(auto.config) }, [auto.config])
  useEffect(() => { if (auto.disponivel) void mensagensRecentes().then(setMsgs) }, [auto.disponivel])

  const salvar = async () => {
    if (f.estoque_alerta && f.telefone_alertas && f.telefone_alertas.replace(/\D/g, '').length < 10) return toast('Telefone de alertas incompleto.', 'error')
    setSalvando(true)
    const erro = await auto.salvar({ ...f, cobranca_dias: [...f.cobranca_dias].sort((a, b) => a - b) })
    setSalvando(false)
    if (erro) return toast(`Não foi possível salvar: ${erro}`, 'error')
    toast(f.whatsapp_ativo ? 'Automação salva e ligada.' : 'Automação salva (WhatsApp automático desligado).')
  }
  const alternarDia = (d: number) => setF((x) => ({ ...x, cobranca_dias: x.cobranca_dias.includes(d) ? x.cobranca_dias.filter((y) => y !== d) : [...x.cobranca_dias, d] }))

  const hoje = (msgs ?? []).filter((m) => new Date(m.created_at).toDateString() === new Date().toDateString())
  const contagem = (st: string) => hoje.filter((m) => m.status === st).length

  return (
    <>
      <p className="cfg-hint" style={{ maxWidth: 760, fontSize: 13 }}>
        Com o WhatsApp oficial da clínica ligado, o sistema envia sozinho as confirmações, cobranças e lembretes — e a resposta
        "1" do paciente já confirma na Agenda. Sem ele, tudo continua funcionando com envio manual pelos botões de WhatsApp.
      </p>

      {!auto.disponivel && (
        <div className="notice">
          <p className="notice-text"><b>Falta preparar o banco.</b> Aplique a migração 0026 no SQL Editor do Supabase para ligar a automação.</p>
        </div>
      )}

      <div className="card auto-card cfg-card">
        <label className="auto-switch">
          <span>
            <b>WhatsApp automático</b>
            <span>Exige as funções publicadas e os modelos aprovados na Meta (guia em supabase/functions/README.md).</span>
          </span>
          <button type="button" className={`switch${f.whatsapp_ativo ? ' on' : ''}`} aria-pressed={f.whatsapp_ativo} disabled={!auto.disponivel}
            onClick={() => setF({ ...f, whatsapp_ativo: !f.whatsapp_ativo })}><span className="switch-knob" /></button>
        </label>

        <FieldRow>
          <Field label="Confirmação de consulta">
            <Select value={String(f.confirmacao_horas)} onChange={(e) => setF({ ...f, confirmacao_horas: Number(e.target.value) })}>
              <option value="12">12 horas antes</option><option value="24">24 horas antes</option><option value="48">48 horas antes</option>
            </Select>
          </Field>
          <Field label="Retorno (pediátrico/adulto)">
            <Select value={String(f.retorno_meses_ped)} onChange={(e) => setF({ ...f, retorno_meses_ped: Number(e.target.value) })}>
              <option value="3">a cada 3 meses</option><option value="6">a cada 6 meses</option><option value="12">a cada 12 meses</option>
            </Select>
          </Field>
        </FieldRow>
        <Field label="Retoque estético">
          <Select value={String(f.retoque_meses_est)} onChange={(e) => setF({ ...f, retoque_meses_est: Number(e.target.value) })}>
            <option value="3">3 meses após o procedimento</option><option value="4">4 meses após o procedimento</option><option value="6">6 meses após o procedimento</option>
          </Select>
        </Field>

        <Field label="Cobrança de parcela (régua)">
          <div className="auto-dias">
            {DIAS_REGUA.map((d) => (
              <button key={d} type="button" aria-pressed={f.cobranca_dias.includes(d)} onClick={() => alternarDia(d)}>{rotuloDia(d)}</button>
            ))}
          </div>
        </Field>

        <label className="check-line"><input type="checkbox" checked={f.aniversario} onChange={(e) => setF({ ...f, aniversario: e.target.checked })} /> Parabéns no aniversário</label>
        <label className="check-line"><input type="checkbox" checked={f.pos_atendimento} onChange={(e) => setF({ ...f, pos_atendimento: e.target.checked })} /> Mensagem no fim do dia para quem foi atendido (como está, dúvidas, avaliação)</label>
        <label className="check-line"><input type="checkbox" checked={f.estoque_alerta} onChange={(e) => setF({ ...f, estoque_alerta: e.target.checked })} /> Alerta diário de estoque (abaixo do mínimo e validade chegando)</label>
        {f.estoque_alerta && (
          <FieldRow>
            <Field label="WhatsApp que recebe o alerta"><TextInput value={f.telefone_alertas ?? ''} inputMode="tel" placeholder="(45) 99999-0000" onChange={(e) => setF({ ...f, telefone_alertas: e.target.value })} /></Field>
            <Field label="Avisar validade com">
              <Select value={String(f.validade_dias)} onChange={(e) => setF({ ...f, validade_dias: Number(e.target.value) })}>
                <option value="15">15 dias</option><option value="30">30 dias</option><option value="60">60 dias</option>
              </Select>
            </Field>
          </FieldRow>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button loading={salvando} disabled={!auto.disponivel} onClick={() => void salvar()}>Salvar automação</Button></div>
      </div>

      {auto.disponivel && (
        <div className="card cfg-card">
          <div className="cfg-card-head">
            <div>
              <h3>Mensagens enviadas</h3>
              <p>hoje: {contagem('enviada') + contagem('entregue') + contagem('lida') + contagem('respondida')} enviadas · {contagem('falhou')} com falha</p>
            </div>
          </div>
          {msgs === null ? <p className="empty-note">Carregando…</p> : msgs.length === 0 ? (
            <p className="empty-note">Nenhuma mensagem automática ainda.</p>
          ) : (
            <ul className="auto-log">
              {msgs.map((m) => (
                <li key={m.id}>
                  <span className={`tag ${STATUS[m.status]?.cls ?? 'tag-neutral'}`}>{STATUS[m.status]?.label ?? m.status}</span>
                  <span className="auto-log-txt">
                    <b>{TIPOS[m.tipo] ?? m.tipo}</b> · {mascara(m.telefone)} · {quando(m.enviada_em ?? m.created_at)}
                    {m.resposta && <> · respondeu <b>{m.resposta === 'confirmar' ? 'confirmar' : m.resposta === 'remarcar' ? 'remarcar' : `“${m.resposta.slice(0, 40)}”`}</b></>}
                    {m.erro && <span className="auto-log-erro">{m.erro}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}
