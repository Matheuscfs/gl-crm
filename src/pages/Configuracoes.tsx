import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { Field, TextInput, FieldRow, Textarea } from '../components/Field'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { useGoogle } from '../lib/GoogleProvider'
import { maskCpf } from '../lib/masks'
import { useStore, type HorarioDia } from '../store'
import { CLINIC_FALLBACK, invalidarClinic } from '../lib/clinic'
import Automacao from './config/Automacao'
import Equipe from './config/Equipe'

type Secao = 'clinica' | 'horarios' | 'equipe' | 'automacao' | 'mensagens' | 'integracoes'

/** Abas em pílula (modelo Aura+): rótulo curto na aba, título e subtítulo no cabeçalho da seção. */
const SECOES: { id: Secao; aba: string; titulo: string; sub: string }[] = [
  { id: 'clinica', aba: 'Dados da clínica', titulo: 'Dados da clínica', sub: 'Quem assina os documentos e como a clínica aparece no recibo e no PIX' },
  { id: 'horarios', aba: 'Horários', titulo: 'Horários de atendimento', sub: 'A Agenda e o agendamento online só oferecem horários dentro do expediente' },
  { id: 'equipe', aba: 'Equipe e acessos', titulo: 'Equipe e acessos', sub: 'Quem entra no sistema e quem administra a equipe' },
  { id: 'automacao', aba: 'Automação', titulo: 'Automação', sub: 'Confirmações, cobranças e lembretes pelo WhatsApp oficial da clínica' },
  { id: 'mensagens', aba: 'Mensagens', titulo: 'Modelos de mensagem', sub: 'Textos prontos para os botões de WhatsApp' },
  { id: 'integracoes', aba: 'Integrações', titulo: 'Integrações', sub: 'Google Agenda e Google Drive' },
]

const SEED_TEMPLATES = [
  { id: 't1', title: 'Lembrete de consulta', body: 'Oi, {responsavel}! Lembrando a consulta da {crianca} em {data}. Confirma?' },
  { id: 't2', title: 'Aniversário', body: 'Feliz aniversário, {crianca}! 🎉 A Dra. Gabriela Lorenzi deseja tudo de bom!' },
  { id: 't3', title: 'Retorno de 6 meses', body: 'Está na hora do retorno da {crianca}. Quer agendar?' },
]

/** Cartão largo com título e linha de apoio; `acao` fica à direita do título. */
function CfgCard({ titulo, sub, acao, children }: { titulo: string; sub?: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="card cfg-card">
      <div className="cfg-card-head">
        <div>
          <h3>{titulo}</h3>
          {sub && <p>{sub}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  )
}

export default function Configuracoes() {
  const { toast } = useToast()
  const google = useGoogle()
  const { horarios, saveHorarios, patients, procedimentos } = useStore()
  const [secao, setSecao] = useState<Secao>('clinica')
  const atual = SECOES.find((s) => s.id === secao) ?? SECOES[0]
  const [templates, setTemplates] = useState(SEED_TEMPLATES)
  const [editTpl, setEditTpl] = useState<(typeof SEED_TEMPLATES)[number] | null>(null)
  // começa com o nome e o CRO da marca e o resto vazio: nada fictício pode ir parar no recibo
  const [clinic, setClinic] = useState({
    name: CLINIC_FALLBACK.name, profissional: CLINIC_FALLBACK.profissional, especialidade: CLINIC_FALLBACK.especialidade,
    cro: CLINIC_FALLBACK.cro, cnpj: '', cpf: '', address: '', cidade: CLINIC_FALLBACK.cidade, uf: CLINIC_FALLBACK.uf, phone: '', pix_key: '',
  })
  const [salvandoClinic, setSalvandoClinic] = useState(false)
  // quantas pessoas da equipe entram no sistema (null = banco sem a 0027 ou modo demonstração)
  const [acessos, setAcessos] = useState<number | null>(supabase ? null : 2)
  // cópia local editável; o Salvar comita no store (que persiste e propaga para a Agenda)
  const [hours, setHours] = useState<HorarioDia[]>(horarios)
  useEffect(() => { setHours(horarios) }, [horarios])

  useEffect(() => {
    const sb = supabase
    if (!sb) return
    let cancelled = false
    ;(async () => {
      const [cs, mt, eq] = await Promise.all([
        sb.from('clinic_settings').select('*').maybeSingle(),
        sb.from('message_templates').select('*').order('created_at'),
        sb.from('team_users').select('id', { count: 'exact', head: true }).eq('ativo', true).not('email', 'is', null),
      ])
      if (cancelled) return
      if (!cs.error && cs.data) {
        const d = cs.data as Record<string, string | null>
        setClinic({
          name: d.name ?? '', profissional: d.profissional || CLINIC_FALLBACK.profissional, especialidade: d.especialidade || CLINIC_FALLBACK.especialidade,
          cro: d.cro ?? '', cnpj: d.cnpj ?? '', cpf: d.cpf ?? '', address: d.address ?? '',
          cidade: d.cidade ?? CLINIC_FALLBACK.cidade, uf: d.uf ?? CLINIC_FALLBACK.uf, phone: d.phone ?? '', pix_key: d.pix_key ?? '',
        })
      }
      if (!mt.error && mt.data?.length) setTemplates(mt.data.map((r) => ({ id: r.id as string, title: (r.title as string) ?? '', body: (r.body as string) ?? '' })))
      if (!eq.error) setAcessos(eq.count ?? 0)
    })().catch((e) => console.error('[supabase] config', e))
    return () => { cancelled = true }
  }, [])

  const saveClinic = async () => {
    if (!clinic.name.trim()) return toast('Informe o nome da clínica.', 'error')
    if (!clinic.profissional.trim()) return toast('Informe o nome de quem assina os documentos.', 'error')
    if (!supabase) return toast('Dados da clínica salvos.')
    setSalvandoClinic(true)
    let { error } = await supabase.from('clinic_settings').upsert({ key: 'clinic', ...clinic }, { onConflict: 'key' })
    // banco sem a migração 0026 ainda não tem cidade/UF/profissional: grava o resto e avisa
    if (error && /cidade|uf|profissional|especialidade/i.test(error.message)) {
      const { cidade, uf, profissional, especialidade, ...base } = clinic
      void cidade; void uf; void profissional; void especialidade
      ;({ error } = await supabase.from('clinic_settings').upsert({ key: 'clinic', ...base }, { onConflict: 'key' }))
      if (!error) toast('Salvo. Cidade, UF e assinatura passam a ser gravadas depois da migração 0026.', 'info')
    }
    setSalvandoClinic(false)
    if (error) return toast(`Não foi possível salvar: ${error.message}`, 'error')
    invalidarClinic()
    toast('Dados da clínica salvos.')
  }
  const saveHours = async () => {
    // "Fechado" (ou vazio) marca o dia como sem atendimento
    const ok = await saveHorarios(hours.map((h) => ({ ...h, closed: h.closed || !h.hours.trim() || /fechado/i.test(h.hours) })))
    toast(ok ? 'Horários salvos — a Agenda já reflete.' : 'Não foi possível salvar os horários.', ok ? 'success' : 'error')
  }
  const saveTpl = () => {
    if (!editTpl) return
    setTemplates((prev) => prev.map((t) => (t.id === editTpl.id ? editTpl : t)))
    if (supabase) {
      if (editTpl.id.includes('-')) supabase.from('message_templates').update({ title: editTpl.title, body: editTpl.body }).eq('id', editTpl.id).then(({ error }) => { if (error) console.error(error.message) })
      else supabase.from('message_templates').insert({ title: editTpl.title, body: editTpl.body }).select('id').single().then(({ data }) => { if (data) setTemplates((prev) => prev.map((t) => (t.id === editTpl.id ? { ...t, id: (data as { id: string }).id } : t))) })
    }
    setEditTpl(null)
    toast('Modelo salvo.')
  }

  const diasAbertos = horarios.filter((h) => !h.closed).length
  const quadro = [
    { v: patients.length, rot: 'Pacientes cadastrados' },
    { v: acessos ?? '—', rot: 'Pessoas com acesso' },
    { v: procedimentos.length, rot: 'Procedimentos na tabela' },
    { v: diasAbertos, rot: diasAbertos === 1 ? 'Dia de atendimento' : 'Dias de atendimento' },
  ]

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">Configurações</div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Seções das configurações">
          {SECOES.map((s) => (
            <button key={s.id} onClick={() => setSecao(s.id)} aria-current={s.id === secao ? 'page' : undefined}>{s.aba}</button>
          ))}
        </nav>

        <div className="settings-content fade-in" key={secao}>
          <div className="cfg-head">
            <h2>{atual.titulo}</h2>
            <p>{atual.sub}</p>
          </div>

          {secao === 'clinica' && (
            <>
              <CfgCard titulo="Meus dados" sub="Como você aparece nos documentos, recibos e registros clínicos que assina.">
                <Field label="Nome completo"><TextInput value={clinic.profissional} onChange={(e) => setClinic({ ...clinic, profissional: e.target.value })} placeholder="Dra. Gabriela Lorenzi" /></Field>
                <FieldRow>
                  <Field label="Especialidade"><TextInput value={clinic.especialidade} onChange={(e) => setClinic({ ...clinic, especialidade: e.target.value })} placeholder="Odontopediatria, harmonização orofacial…" /></Field>
                  <Field label="Registro profissional"><TextInput value={clinic.cro} onChange={(e) => setClinic({ ...clinic, cro: e.target.value })} placeholder="CRO-PR 00000" /></Field>
                </FieldRow>
                <Field label="CPF">
                  <TextInput value={clinic.cpf} inputMode="numeric" onChange={(e) => setClinic({ ...clinic, cpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" />
                  <span className="cfg-hint">Sai no rodapé do recibo e identifica a titular no Carnê-Leão.</span>
                </Field>
              </CfgCard>

              <CfgCard titulo="Quadro da clínica">
                <div className="cfg-stats">
                  {quadro.map((q) => (
                    <div key={q.rot} className="cfg-stat"><b className="tnum">{q.v}</b><span>{q.rot}</span></div>
                  ))}
                </div>
                <p className="cfg-hint">
                  Contagem do que está cadastrado agora. Quem entra no sistema fica em{' '}
                  <button type="button" className="cfg-link" onClick={() => setSecao('equipe')}>Equipe e acessos</button>.
                </p>
              </CfgCard>

              <CfgCard titulo="Dados cadastrais" sub="Cabeçalho e rodapé dos documentos e do recibo.">
                <FieldRow>
                  <Field label="Nome de exibição"><TextInput value={clinic.name} onChange={(e) => setClinic({ ...clinic, name: e.target.value })} /></Field>
                  <Field label="CNPJ (opcional)"><TextInput value={clinic.cnpj} inputMode="numeric" onChange={(e) => setClinic({ ...clinic, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></Field>
                </FieldRow>
                <Field label="Endereço"><TextInput value={clinic.address} onChange={(e) => setClinic({ ...clinic, address: e.target.value })} placeholder="Rua, número, bairro" /></Field>
                <FieldRow>
                  <Field label="Cidade"><TextInput value={clinic.cidade} onChange={(e) => setClinic({ ...clinic, cidade: e.target.value })} placeholder="Cascavel" /></Field>
                  <Field label="UF"><TextInput value={clinic.uf} maxLength={2} onChange={(e) => setClinic({ ...clinic, uf: e.target.value.toUpperCase() })} placeholder="PR" /></Field>
                </FieldRow>
                <Field label="Telefone"><TextInput type="tel" inputMode="tel" value={clinic.phone} onChange={(e) => setClinic({ ...clinic, phone: e.target.value })} placeholder="(45) 99999-0000" /></Field>
              </CfgCard>

              <CfgCard titulo="Recebimentos" sub="Usada na cobrança por WhatsApp e no PIX copia e cola do Financeiro.">
                <Field label="Chave PIX"><TextInput value={clinic.pix_key} onChange={(e) => setClinic({ ...clinic, pix_key: e.target.value })} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" /></Field>
              </CfgCard>

              <div className="cfg-actions"><Button loading={salvandoClinic} onClick={saveClinic}>Salvar alterações</Button></div>
            </>
          )}

          {secao === 'horarios' && (
            <CfgCard titulo="Expediente" sub='Escreva "Fechado" (ou deixe vazio) nos dias sem atendimento.'
              acao={<Button size="sm" onClick={saveHours}>Salvar</Button>}>
              <div className="cfg-horas">
                {hours.map((d, i) => (
                  <label key={d.day} className="cfg-hora">
                    <span>{d.day}</span>
                    <input className="field-input" value={d.hours} onChange={(e) => setHours((h) => h.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))} />
                  </label>
                ))}
              </div>
            </CfgCard>
          )}

          {secao === 'equipe' && <Equipe />}

          {secao === 'automacao' && <Automacao />}

          {secao === 'mensagens' && (
            <div className="cfg-grid">
              {templates.map((t) => (
                <CfgCard key={t.id} titulo={t.title} acao={<Button size="sm" variant="teal-soft" onClick={() => setEditTpl(t)}>Editar</Button>}>
                  <p className="cfg-texto">{t.body}</p>
                </CfgCard>
              ))}
            </div>
          )}

          {secao === 'integracoes' && (
            <CfgCard titulo="Google Agenda e Drive"
              sub={!google.configured ? 'Falta o VITE_GOOGLE_CLIENT_ID no .env' : google.connected ? 'Conectado · agendamentos vão para a Agenda do Google e arquivos para o Drive' : 'Envie agendamentos para a Agenda do Google e arquivos para o Drive'}
              acao={google.connected
                ? <Button variant="outline" onClick={() => { google.disconnect(); toast('Google desconectado.', 'info') }}>Desconectar</Button>
                : <Button loading={google.connecting} disabled={!google.configured} onClick={async () => { const ok = await google.connect(); toast(ok ? 'Google conectado.' : 'Não foi possível conectar.', ok ? 'success' : 'error') }}>Conectar Google</Button>}>
              <p className="cfg-nota">
                Pré-requisito: crie um <b>OAuth Client ID</b> (Web) no Google Cloud, habilite as APIs <b>Calendar</b> e <b>Drive</b>, adicione a origem do app em "Authorized JavaScript origins" e coloque o ID em <b>VITE_GOOGLE_CLIENT_ID</b>.
              </p>
            </CfgCard>
          )}
        </div>
      </div>

      {/* Editar modelo */}
      <Modal open={!!editTpl} onClose={() => setEditTpl(null)} title={editTpl?.title ?? ''} subtitle="Modelo de mensagem" width={460}
        footer={<><Button variant="outline" onClick={() => setEditTpl(null)}>Cancelar</Button><Button onClick={saveTpl}>Salvar</Button></>}>
        {editTpl && (
          <>
            <Field label="Título"><TextInput value={editTpl.title} onChange={(e) => setEditTpl({ ...editTpl, title: e.target.value })} /></Field>
            <Field label="Mensagem"><Textarea value={editTpl.body} onChange={(e) => setEditTpl({ ...editTpl, body: e.target.value })} /></Field>
          </>
        )}
      </Modal>
    </>
  )
}
