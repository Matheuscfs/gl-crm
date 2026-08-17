import { useEffect, useState } from 'react'
import { Icon } from '../icons'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { Field, TextInput, FieldRow, Textarea, Select } from '../components/Field'
import { Menu } from '../components/Menu'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { useGoogle } from '../lib/GoogleProvider'
import { maskCpf } from '../lib/masks'
import { useStore, type HorarioDia } from '../store'

interface UserRow { id: string; name: string; role: string; initials: string }
const initials2 = (n: string) => n.trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()

const SECTIONS = ['Perfil da clínica', 'Horários de atendimento', 'Modelos de mensagem', 'Usuários & acesso', 'Integrações']

const SEED_TEMPLATES = [
  { id: 't1', title: 'Lembrete 48h antes', body: 'Oi, {responsavel}! Lembrando a consulta da {crianca} em {data}. Confirma?' },
  { id: 't2', title: 'Aniversário', body: 'Feliz aniversário, {crianca}! 🎉 A Dra. Gabriela Lorenzi deseja tudo de bom!' },
  { id: 't3', title: 'Retorno de 6 meses', body: 'Está na hora do retorno da {crianca}. Quer agendar?' },
]
const SEED_USERS = [
  { name: 'Dra. Gabriela Lorenzi', role: 'Cirurgiã Dentista · Admin', initials: 'GL' },
  { name: 'Camila Souza', role: 'Recepção', initials: 'CS' },
  { name: 'Bruna Teixeira', role: 'Auxiliar de saúde bucal', initials: 'BT' },
]

export default function Configuracoes() {
  const { toast } = useToast()
  const google = useGoogle()
  const { horarios, saveHorarios } = useStore()
  const [section, setSection] = useState('Perfil da clínica')
  const [templates, setTemplates] = useState(SEED_TEMPLATES)
  const [editTpl, setEditTpl] = useState<(typeof SEED_TEMPLATES)[number] | null>(null)
  const [clinic, setClinic] = useState({ name: 'Consultório Dra. Gabriela Lorenzi', cro: 'CRO 39889', cnpj: '00.000.000/0001-00', cpf: '', address: 'Cascavel-PR', phone: '(45) 90000-0000', pix_key: '' })
  // cópia local editável; o Salvar comita no store (que persiste e propaga para a Agenda)
  const [hours, setHours] = useState<HorarioDia[]>(horarios)
  useEffect(() => { setHours(horarios) }, [horarios])
  const [users, setUsers] = useState<UserRow[]>(SEED_USERS.map((u, i) => ({ id: `seed-u${i}`, ...u })))
  const [invite, setInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name: '', role: 'Recepção' })

  useEffect(() => {
    const sb = supabase
    if (!sb) return
    let cancelled = false
    ;(async () => {
      const [cs, mt, tu] = await Promise.all([
        sb.from('clinic_settings').select('*').maybeSingle(),
        sb.from('message_templates').select('*').order('created_at'),
        sb.from('team_users').select('*').order('created_at'),
      ])
      if (cancelled) return
      if (!cs.error && cs.data) setClinic({ name: cs.data.name ?? '', cro: cs.data.cro ?? '', cnpj: cs.data.cnpj ?? '', cpf: (cs.data.cpf as string | null) ?? '', address: cs.data.address ?? '', phone: cs.data.phone ?? '', pix_key: (cs.data.pix_key as string | null) ?? '' })
      if (!mt.error && mt.data?.length) setTemplates(mt.data.map((r) => ({ id: r.id as string, title: (r.title as string) ?? '', body: (r.body as string) ?? '' })))
      if (!tu.error && tu.data?.length) setUsers(tu.data.map((r) => ({ id: r.id as string, name: (r.name as string) ?? '', role: (r.role as string) ?? '', initials: (r.initials as string) ?? '' })))
    })().catch((e) => console.error('[supabase] config', e))
    return () => { cancelled = true }
  }, [])

  const saveClinic = () => {
    if (supabase) supabase.from('clinic_settings').upsert({ key: 'clinic', ...clinic }, { onConflict: 'key' }).then(({ error }) => { if (error) console.error(error.message) })
    toast('Perfil da clínica salvo.')
  }
  const saveHours = () => {
    // "Fechado" (ou vazio) marca o dia como sem atendimento
    saveHorarios(hours.map((h) => ({ ...h, closed: h.closed || !h.hours.trim() || /fechado/i.test(h.hours) })))
    toast('Horários salvos — a Agenda já reflete.')
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
  const addUser = () => {
    if (!inviteForm.name.trim()) return toast('Informe o nome.', 'error')
    const u: UserRow = { id: `tmp-${Date.now()}`, name: inviteForm.name.trim(), role: inviteForm.role, initials: initials2(inviteForm.name) }
    setUsers((prev) => [...prev, u])
    if (supabase) supabase.from('team_users').insert({ name: u.name, role: u.role, initials: u.initials }).select('id').single().then(({ data }) => { if (data) setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, id: (data as { id: string }).id } : x))) })
    setInvite(false)
    setInviteForm({ name: '', role: 'Recepção' })
    toast('Convite enviado.')
  }
  const removeUser = (u: UserRow) => {
    setUsers((prev) => prev.filter((x) => x.id !== u.id))
    if (supabase && u.id.includes('-') && !u.id.startsWith('tmp')) supabase.from('team_users').delete().eq('id', u.id).then(({ error }) => { if (error) console.error(error.message) })
    toast('Acesso removido.')
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">Configurações</div>
      </header>

      <div style={{ flex: 1, overflow: 'hidden', display: 'grid', gridTemplateColumns: '210px 1fr' }}>
        <div style={{ borderRight: '1px solid #eff2f9', padding: '18px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {SECTIONS.map((s) => (
            <button key={s} onClick={() => setSection(s)}
              style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: 'none', font: `${s === section ? 700 : 600} 13px 'Plus Jakarta Sans'`, color: s === section ? '#2f52e0' : '#5b647a', background: s === section ? '#e9eeff' : 'transparent', cursor: 'pointer' }}>
              {s}
            </button>
          ))}
        </div>

        <div style={{ overflow: 'auto', padding: '22px 24px' }} className="fade-in" key={section}>
          {section === 'Perfil da clínica' && (
            <>
              <div style={{ font: "800 16px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 14 }}>Perfil da clínica</div>
              <div className="card" style={{ padding: '20px 22px', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Nome"><TextInput value={clinic.name} onChange={(e) => setClinic({ ...clinic, name: e.target.value })} /></Field>
                <FieldRow>
                  <Field label="CRO"><TextInput value={clinic.cro} onChange={(e) => setClinic({ ...clinic, cro: e.target.value })} /></Field>
                  <Field label="CNPJ"><TextInput value={clinic.cnpj} onChange={(e) => setClinic({ ...clinic, cnpj: e.target.value })} /></Field>
                </FieldRow>
                <Field label="CPF da profissional">
                  <TextInput value={clinic.cpf} onChange={(e) => setClinic({ ...clinic, cpf: maskCpf(e.target.value) })} placeholder="000.000.000-00" />
                  <span style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8b93a7', marginTop: 4 }}>Sai no rodapé do recibo e identifica a titular no Carnê-Leão.</span>
                </Field>
                <Field label="Endereço"><TextInput value={clinic.address} onChange={(e) => setClinic({ ...clinic, address: e.target.value })} /></Field>
                <Field label="Telefone"><TextInput value={clinic.phone} onChange={(e) => setClinic({ ...clinic, phone: e.target.value })} /></Field>
                <Field label="Chave PIX">
                  <TextInput value={clinic.pix_key} onChange={(e) => setClinic({ ...clinic, pix_key: e.target.value })} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
                  <span style={{ font: "600 11px 'Plus Jakarta Sans'", color: '#8b93a7', marginTop: 4 }}>Usada na cobrança por WhatsApp e no PIX copia e cola do Financeiro.</span>
                </Field>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={saveClinic}>Salvar alterações</Button></div>
              </div>
            </>
          )}

          {section === 'Horários de atendimento' && (
            <>
              <div style={{ font: "800 16px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 14 }}>Horários de atendimento</div>
              <div className="card" style={{ padding: '6px 16px', maxWidth: 460 }}>
                {hours.map((d, i) => (
                  <div key={d.day} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f2f5fb' }}>
                    <span style={{ font: "600 12.5px 'Plus Jakarta Sans'", color: '#5b647a' }}>{d.day}</span>
                    <input className="field-input" style={{ width: 170, height: 32, textAlign: 'right' }} value={d.hours} onChange={(e) => setHours((h) => h.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))} />
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 0 6px' }}><Button size="sm" onClick={saveHours}>Salvar</Button></div>
              </div>
            </>
          )}

          {section === 'Modelos de mensagem' && (
            <>
              <div style={{ font: "800 16px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 14 }}>Modelos de mensagem</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 620 }}>
                {templates.map((t) => (
                  <div key={t.id} className="card card-hover" style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ font: "800 13.5px 'Plus Jakarta Sans'", color: '#26324a' }}>{t.title}</span>
                      <Button size="sm" variant="teal-soft" onClick={() => setEditTpl(t)}>Editar</Button>
                    </div>
                    <div style={{ font: "500 12.5px/1.6 'Plus Jakarta Sans'", color: '#5b647a' }}>{t.body}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {section === 'Usuários & acesso' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ font: "800 16px 'Plus Jakarta Sans'", color: '#26324a' }}>Usuários & acesso</div>
                <Button size="sm" icon={<Icon name="plus" size={16} />} onClick={() => { setInviteForm({ name: '', role: 'Recepção' }); setInvite(true) }}>Convidar</Button>
              </div>
              <div className="card" style={{ overflow: 'hidden', maxWidth: 620 }}>
                {users.map((u) => (
                  <div key={u.id} className="table-row" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <div className="avatar" style={{ width: 36, height: 36 }}>{u.initials}</div>
                      <div>
                        <div style={{ font: "700 13px 'Plus Jakarta Sans'", color: '#26324a' }}>{u.name}</div>
                        <div style={{ font: "600 11.5px 'Plus Jakarta Sans'", color: '#8b93a7' }}>{u.role}</div>
                      </div>
                    </div>
                    <Menu items={[{ label: 'Editar permissões', onClick: () => toast('Permissões — em breve.', 'info') }, { label: 'Remover acesso', danger: true, onClick: () => removeUser(u) }]} />
                  </div>
                ))}
              </div>
            </>
          )}

          {section === 'Integrações' && (
            <>
              <div style={{ font: "800 16px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 14 }}>Integrações</div>
              <div className="card" style={{ padding: '18px 20px', maxWidth: 560 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: '#e9eeff', color: '#3f6bf5', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "800 18px 'Plus Jakarta Sans'" }}>G</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: "800 14px 'Plus Jakarta Sans'", color: '#26324a' }}>Google Calendar & Drive</div>
                    <div style={{ font: "600 12px 'Plus Jakarta Sans'", color: '#8b93a7' }}>
                      {!google.configured ? 'Configure VITE_GOOGLE_CLIENT_ID no .env' : google.connected ? 'Conectado · agendamentos vão ao Calendar e arquivos ao Drive' : 'Envie agendamentos ao Calendar e arquivos ao Drive'}
                    </div>
                  </div>
                  {google.connected ? (
                    <Button variant="outline" onClick={() => { google.disconnect(); toast('Google desconectado.', 'info') }}>Desconectar</Button>
                  ) : (
                    <Button loading={google.connecting} disabled={!google.configured} onClick={async () => { const ok = await google.connect(); toast(ok ? 'Google conectado.' : 'Não foi possível conectar.', ok ? 'success' : 'error') }}>Conectar Google</Button>
                  )}
                </div>
                <div style={{ marginTop: 14, padding: '11px 13px', background: '#f5f8ff', borderRadius: 10, font: "600 11.5px/1.6 'Plus Jakarta Sans'", color: '#5b647a' }}>
                  Pré-requisito: crie um <b>OAuth Client ID</b> (Web) no Google Cloud, habilite as APIs <b>Calendar</b> e <b>Drive</b>, adicione a origem do app em "Authorized JavaScript origins" e coloque o ID em <b>VITE_GOOGLE_CLIENT_ID</b>.
                </div>
              </div>
            </>
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

      {/* Convidar usuário */}
      <Modal open={invite} onClose={() => setInvite(false)} title="Convidar usuário" width={420}
        footer={<><Button variant="outline" onClick={() => setInvite(false)}>Cancelar</Button><Button onClick={addUser}>Enviar convite</Button></>}>
        <Field label="Nome"><TextInput autoFocus value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} placeholder="Ex.: Bruna Teixeira" /></Field>
        <Field label="Função"><Select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}><option>Recepção</option><option>Auxiliar de saúde bucal</option><option>Cirurgiã Dentista</option><option>Administrador</option></Select></Field>
      </Modal>
    </>
  )
}
