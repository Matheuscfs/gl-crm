import { useEffect, useState } from 'react'
import { Icon } from '../../icons'
import { Button } from '../../components/Button'
import { Modal } from '../../components/Modal'
import { Field, Select, TextInput } from '../../components/Field'
import { Menu } from '../../components/Menu'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useToast } from '../../components/Toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { DEMO_DATA } from '../../lib/demo'

interface Membro { id: string; name: string; role: string; initials: string; email: string; ativo: boolean; admin: boolean }

const iniciais = (n: string) => n.trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()
const DEMO: Membro[] = [
  { id: 'seed-u0', name: 'Dra. Gabriela Lorenzi', role: 'Cirurgiã Dentista · Admin', initials: 'GL', email: 'dra@exemplo.com', ativo: true, admin: true },
  { id: 'seed-u1', name: 'Camila Souza', role: 'Recepção', initials: 'CS', email: 'recepcao@exemplo.com', ativo: true, admin: false },
]

/**
 * Equipe = lista de acesso (migração 0027): quem está aqui com e-mail e ativo entra no sistema;
 * quem cria conta sem estar na lista fica em "acesso pendente". Só a administradora altera.
 */
export default function Equipe() {
  const { toast } = useToast()
  const { situacao, email: meuEmail } = useAuth()
  const admin = !supabase || situacao === 'admin'
  const [membros, setMembros] = useState<Membro[]>(DEMO_DATA ? DEMO : [])
  const [semColunas, setSemColunas] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'Recepção' })
  const [salvando, setSalvando] = useState(false)
  const [desativando, setDesativando] = useState<Membro | null>(null)

  const carregar = () => {
    if (!supabase) return
    supabase.from('team_users').select('*').order('created_at').then(({ data, error }) => {
      if (error) return
      setSemColunas(!!data?.length && !('email' in data[0]))
      setMembros((data ?? []).map((r) => ({
        id: r.id as string, name: (r.name as string) ?? '', role: (r.role as string) ?? '', initials: (r.initials as string) ?? '',
        email: (r.email as string) ?? '', ativo: r.ativo !== false, admin: !!r.admin,
      })))
    })
  }
  useEffect(carregar, [])

  const adicionar = async () => {
    const email = form.email.trim().toLowerCase()
    if (!form.name.trim()) return toast('Informe o nome.', 'error')
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Informe o e-mail que a pessoa vai usar para entrar.', 'error')
    if (membros.some((m) => m.email.toLowerCase() === email)) return toast('Este e-mail já está na equipe.', 'error')
    if (!supabase) { setMembros((p) => [...p, { id: `tmp-${Date.now()}`, name: form.name.trim(), role: form.role, initials: iniciais(form.name), email, ativo: true, admin: false }]); setAberto(false); return }
    setSalvando(true)
    const { error } = await supabase.from('team_users').insert({ name: form.name.trim(), role: form.role, initials: iniciais(form.name), email, ativo: true, admin: false })
    setSalvando(false)
    if (error) return toast(semColunas || /email|column/i.test(error.message) ? 'Aplique a migração 0027 para cadastrar e-mails de acesso.' : `Não foi possível adicionar: ${error.message}`, 'error')
    setAberto(false)
    carregar()
    toast(`${form.name.trim()} pode entrar: é só ir em "Criar conta" com ${email}.`)
  }

  const atualizar = async (m: Membro, patch: Partial<Membro>, msg: string) => {
    if (supabase) {
      const { error } = await supabase.from('team_users').update(patch).eq('id', m.id)
      if (error) return toast(`Não foi possível salvar: ${error.message}`, 'error')
    }
    setMembros((p) => p.map((x) => (x.id === m.id ? { ...x, ...patch } : x)))
    toast(msg)
  }

  const souEu = (m: Membro) => !!meuEmail && m.email.toLowerCase() === meuEmail.toLowerCase()

  return (
    <>
      <section className="card cfg-card">
        <div className="cfg-card-head">
          <div>
            <h3>Pessoas com acesso</h3>
            <p>
              Quem está nesta lista, com e-mail e ativo, entra no sistema: a pessoa abre o login, toca em <b>Criar conta</b> e usa o mesmo e-mail.
              Contas fora da lista ficam em "acesso pendente" e não veem nenhum dado. Desativar corta o acesso na hora.
              {!admin && <><br /><b>Só a administradora altera a equipe.</b></>}
            </p>
          </div>
          {admin && <Button size="sm" icon={<Icon name="plus" size={16} />} onClick={() => { setForm({ name: '', email: '', role: 'Recepção' }); setAberto(true) }}>Adicionar</Button>}
        </div>
        {semColunas && <div className="notice"><p className="notice-text"><b>Falta a migração 0027</b> para o controle de acesso por e-mail.</p></div>}
        {membros.length === 0 && <p className="cfg-hint">Ninguém cadastrado na equipe ainda.</p>}
        {membros.length > 0 && (
          <div className="cfg-lista">
            {membros.map((m) => (
              <div key={m.id} className="table-row" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center', opacity: m.ativo ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <div className="avatar" style={{ width: 36, height: 36 }}>{m.initials || iniciais(m.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: '600 13px var(--font)', color: 'var(--ink)' }}>
                      {m.name}{souEu(m) && <span style={{ fontWeight: 400, color: 'var(--muted)' }}> · você</span>}
                      {m.admin && <span className="tag tag-info" style={{ minWidth: 0, marginLeft: 8 }}>admin</span>}
                      {!m.ativo && <span className="tag tag-neutral" style={{ minWidth: 0, marginLeft: 8 }}>sem acesso</span>}
                    </div>
                    <div style={{ font: '400 12px var(--font)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.role}{m.email ? ` · ${m.email}` : ' · sem e-mail (não entra no sistema)'}
                    </div>
                  </div>
                </div>
                {admin && !souEu(m) && (
                  <Menu width={210} items={[
                    m.ativo
                      ? { label: 'Desativar acesso', danger: true, onClick: () => setDesativando(m) }
                      : { label: 'Reativar acesso', onClick: () => void atualizar(m, { ativo: true }, `${m.name} voltou a ter acesso.`) },
                    { label: m.admin ? 'Tirar administração' : 'Tornar administradora', onClick: () => void atualizar(m, { admin: !m.admin }, m.admin ? `${m.name} não administra mais a equipe.` : `${m.name} agora administra a equipe.`) },
                  ]} />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={aberto} onClose={() => setAberto(false)} title="Adicionar à equipe" width={420}
        footer={<><Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button><Button loading={salvando} onClick={() => void adicionar()}>Adicionar</Button></>}>
        <Field label="Nome"><TextInput autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Bruna Teixeira" /></Field>
        <Field label="E-mail de acesso"><TextInput type="email" inputMode="email" autoCapitalize="none" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nome@email.com" /></Field>
        <Field label="Função"><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option>Recepção</option><option>Auxiliar de saúde bucal</option><option>Cirurgiã Dentista</option><option>Administrador</option></Select></Field>
      </Modal>

      <ConfirmDialog open={!!desativando} onClose={() => setDesativando(null)}
        onConfirm={() => { if (desativando) void atualizar(desativando, { ativo: false }, `${desativando.name} não tem mais acesso.`) }}
        title="Desativar acesso" message={`${desativando?.name ?? ''} deixa de ver os dados da clínica na hora. Dá para reativar depois.`} confirmLabel="Desativar" />
    </>
  )
}
