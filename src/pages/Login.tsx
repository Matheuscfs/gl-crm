import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '../components/Button'
import { LogoAnimada } from '../components/LogoAnimada'
import { Icon } from '../icons'
import { useAuth } from '../lib/auth'
import { BRAND } from '../brand'

/**
 * Entrada do consultório — sem sessão, nada do CRM é carregado.
 * Linha Aura+: à esquerda o que o sistema faz (os cartões são ilustrativos, sem dado de
 * paciente); à direita o cartão: Entrar, Criar conta ou Esqueceu a senha.
 * Criar conta não dá acesso aos dados: a conta fica "pendente" até a Dra. incluir o e-mail na
 * equipe (Configurações → Usuários & acesso; migração 0027).
 */
export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'criar' | 'esqueci'>('entrar')
  return (
    <LoginLayout>
      {modo !== 'esqueci' && (
        <div className="lg-tabs" role="tablist" aria-label="Acesso">
          <button role="tab" type="button" aria-selected={modo === 'entrar'} onClick={() => setModo('entrar')}>Entrar</button>
          <button role="tab" type="button" aria-selected={modo === 'criar'} onClick={() => setModo('criar')}>Criar conta</button>
        </div>
      )}
      {modo === 'entrar' && <Entrar onEsqueci={() => setModo('esqueci')} />}
      {modo === 'criar' && <CriarConta onEntrar={() => setModo('entrar')} />}
      {modo === 'esqueci' && <Esqueci onVoltar={() => setModo('entrar')} />}
    </LoginLayout>
  )
}

/* ---------- Entrar ---------- */
function Entrar({ onEsqueci }: { onEsqueci: () => void }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [entrando, setEntrando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!email.trim() || !senha) return setErro('Preencha e-mail e senha.')
    setEntrando(true)
    const msg = await signIn(email, senha)
    setEntrando(false)
    if (msg) setErro(msg)
  }

  return (
    <form className="lg-form" onSubmit={enviar} noValidate>
      <CardTitulo titulo="Entrar no consultório" sub="Use o e-mail e a senha da sua conta da equipe." />
      <CampoEmail value={email} onChange={setEmail} autoFocus />
      <CampoSenha label="Senha" value={senha} onChange={setSenha} autoComplete="current-password"
        extra={<button type="button" className="lg-link" onClick={onEsqueci}>Esqueceu a senha?</button>} />
      {erro && <div className="lg-msg erro" role="alert">{erro}</div>}
      <Button type="submit" block loading={entrando} className="lg-submit">Entrar</Button>
      <div className="lg-sep" />
      <p className="lg-note">Primeiro acesso? Toque em <b>Criar conta</b> com o e-mail que a {BRAND.dentist} cadastrou para você.</p>
    </form>
  )
}

/* ---------- Criar conta ---------- */
function CriarConta({ onEntrar }: { onEntrar: () => void }) {
  const { signUp } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!nome.trim()) return setErro('Informe o seu nome.')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro('Informe um e-mail válido.')
    if (senha.length < 8 || !/\d/.test(senha) || !/[a-zA-Z]/.test(senha)) return setErro('A senha precisa de pelo menos 8 caracteres, com letras e números.')
    if (senha !== confirma) return setErro('As senhas não conferem.')
    setEnviando(true)
    const r = await signUp(nome, email, senha)
    setEnviando(false)
    if (r.erro) return setErro(r.erro)
    // sem confirmação por e-mail o Supabase já abre a sessão e o app mostra o acesso (ou "pendente")
    if (r.confirmar) setFeito(email.trim())
  }

  if (feito) {
    return (
      <div className="lg-form" role="status">
        <CardTitulo titulo="Confirme o seu e-mail" sub={`Enviamos um link para ${feito}. Abra o e-mail, confirme e volte aqui para entrar.`} />
        <Button block className="lg-submit" onClick={onEntrar}>Ir para Entrar</Button>
      </div>
    )
  }

  return (
    <form className="lg-form" onSubmit={enviar} noValidate>
      <CardTitulo titulo="Criar conta" sub="Para a equipe da clínica. O acesso aos dados é liberado pela Dra." />
      <div className="lg-field">
        <label className="lg-label" htmlFor="lg-nome">Seu nome</label>
        <input id="lg-nome" className="lg-input" autoComplete="name" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome e sobrenome" />
      </div>
      <CampoEmail value={email} onChange={setEmail} />
      <CampoSenha label="Senha" value={senha} onChange={setSenha} autoComplete="new-password" />
      <CampoSenha label="Confirme a senha" id="lg-senha2" value={confirma} onChange={setConfirma} autoComplete="new-password" />
      <ForcaSenha senha={senha} />
      {erro && <div className="lg-msg erro" role="alert">{erro}</div>}
      <Button type="submit" block loading={enviando} className="lg-submit">Criar conta</Button>
    </form>
  )
}

/* ---------- Esqueci a senha ---------- */
function Esqueci({ onVoltar }: { onVoltar: () => void }) {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    setAviso('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro('Digite o e-mail da sua conta.')
    setEnviando(true)
    const msg = await resetPassword(email)
    setEnviando(false)
    if (msg) setErro(msg)
    else setAviso(`Se ${email.trim()} tiver conta, chega um link para criar uma senha nova. Confira também o spam.`)
  }

  return (
    <form className="lg-form" onSubmit={enviar} noValidate>
      <CardTitulo titulo="Esqueceu a senha?" sub="Mandamos um link para o seu e-mail. Ao abrir, você cria a senha nova aqui mesmo." />
      <CampoEmail value={email} onChange={setEmail} autoFocus />
      {erro && <div className="lg-msg erro" role="alert">{erro}</div>}
      {aviso && <div className="lg-msg ok" role="status">{aviso}</div>}
      <Button type="submit" block loading={enviando} className="lg-submit">Enviar link</Button>
      <button type="button" className="lg-link lg-back" onClick={onVoltar}>Voltar para o login</button>
    </form>
  )
}

/* ---------- Nova senha (volta do link do e-mail) ---------- */
export function NovaSenha() {
  const { updatePassword, email } = useAuth()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (senha.length < 8 || !/\d/.test(senha) || !/[a-zA-Z]/.test(senha)) return setErro('A senha precisa de pelo menos 8 caracteres, com letras e números.')
    if (senha !== confirma) return setErro('As senhas não conferem.')
    setSalvando(true)
    const msg = await updatePassword(senha)
    setSalvando(false)
    if (msg) setErro(msg)
  }

  return (
    <LoginLayout>
      <form className="lg-form" onSubmit={enviar} noValidate>
        <CardTitulo titulo="Criar nova senha" sub={email ? `Conta ${email}.` : 'Escolha a senha nova da sua conta.'} />
        <CampoSenha label="Nova senha" value={senha} onChange={setSenha} autoComplete="new-password" autoFocus />
        <CampoSenha label="Confirme a nova senha" id="lg-senha2" value={confirma} onChange={setConfirma} autoComplete="new-password" />
        <ForcaSenha senha={senha} />
        {erro && <div className="lg-msg erro" role="alert">{erro}</div>}
        <Button type="submit" block loading={salvando} className="lg-submit">Salvar e entrar</Button>
      </form>
    </LoginLayout>
  )
}

/* ---------- Acesso pendente (conta criada, fora da equipe) ---------- */
export function AcessoPendente() {
  const { email, conferirAcesso, signOut } = useAuth()
  const [conferindo, setConferindo] = useState(false)
  const [aviso, setAviso] = useState('')
  const conferir = async () => {
    setConferindo(true)
    await conferirAcesso()
    setConferindo(false)
    setAviso('Ainda não liberado. Confirme com a Dra. que o e-mail foi incluído exatamente como abaixo.')
  }
  return (
    <LoginLayout>
      <div className="lg-form">
        <CardTitulo titulo="Acesso aguardando liberação" sub="Sua conta foi criada, mas os dados da clínica só aparecem para quem está na equipe." />
        <div className="lg-pendente">
          <Icon name="users" size={18} />
          <p>Peça à {BRAND.dentist} para incluir <b>{email}</b> em <b>Configurações → Usuários & acesso</b>. Depois toque em “Já fui liberada”.</p>
        </div>
        {aviso && <div className="lg-msg erro" role="status">{aviso}</div>}
        <Button block loading={conferindo} className="lg-submit" onClick={() => void conferir()}>Já fui liberada</Button>
        <button type="button" className="lg-link lg-back" onClick={() => void signOut()}>Sair e entrar com outra conta</button>
      </div>
    </LoginLayout>
  )
}

/* ---------- peças ---------- */
function CardTitulo({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <div>
      <h2 className="lg-card-title">{titulo}</h2>
      <p className="lg-card-sub">{sub}</p>
    </div>
  )
}

function CampoEmail({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className="lg-field">
      <label className="lg-label" htmlFor="lg-email">E-mail</label>
      <input id="lg-email" className="lg-input" type="email" inputMode="email" autoFocus={autoFocus} autoComplete="username"
        autoCapitalize="none" spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} placeholder="voce@clinica.com.br" />
    </div>
  )
}

function CampoSenha({ label, value, onChange, autoComplete, extra, id = 'lg-senha', autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; autoComplete: string; extra?: ReactNode; id?: string; autoFocus?: boolean
}) {
  const [ver, setVer] = useState(false)
  const [caps, setCaps] = useState(false)
  const olharCaps = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState('CapsLock'))
  return (
    <div className="lg-field">
      <div className="lg-label-row">
        <label className="lg-label" htmlFor={id}>{label}</label>
        {extra}
      </div>
      <div className="lg-pass">
        <input id={id} className="lg-input" type={ver ? 'text' : 'password'} autoComplete={autoComplete} autoFocus={autoFocus} value={value}
          onChange={(e) => onChange(e.target.value)} onKeyUp={olharCaps} onKeyDown={olharCaps} onBlur={() => setCaps(false)} />
        <button type="button" className="lg-eye" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={ver}>
          <Icon name={ver ? 'eye-off' : 'eye'} size={18} />
        </button>
      </div>
      {caps && <div className="lg-caps"><Icon name="alert" size={14} /> Caps Lock ligado</div>}
    </div>
  )
}

/** Barrinha de força da senha (comprimento, letras, números, símbolo). */
function ForcaSenha({ senha }: { senha: string }) {
  if (!senha) return null
  const pontos = [senha.length >= 8, /[a-z]/.test(senha) && /[A-Z]/.test(senha), /\d/.test(senha), /[^a-zA-Z0-9]/.test(senha), senha.length >= 12].filter(Boolean).length
  const nivel = pontos <= 2 ? { t: 'fraca', c: 'var(--danger)' } : pontos === 3 ? { t: 'razoável', c: 'var(--amber)' } : { t: 'forte', c: 'var(--green)' }
  return (
    <div className="lg-forca" aria-live="polite">
      <span style={{ width: `${(pontos / 5) * 100}%`, background: nivel.c }} />
      <small>Senha {nivel.t}</small>
    </div>
  )
}

/** Moldura do login: logo animada, lado ilustrativo e cartão. */
function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="login-bg login-page">
      <header className="lg-top">
        <LogoAnimada className="lg-logo" />
      </header>

      <main className="lg-main">
        <section className="lg-hero">
          <h1 className="lg-title">
            <span>O consultório inteiro</span>
            <span className="lg-title-2">numa tela só.</span>
          </h1>
          <p className="lg-lead">
            Agenda, prontuário, odontograma e financeiro da {BRAND.dentist}, com retornos e
            cobranças saindo direto pelo WhatsApp.
          </p>

          <ol className="lg-feed" aria-hidden="true">
            <li className="lg-ev">
              <span className="lg-ev-ico violet"><Icon name="cal" size={17} /></span>
              <span className="lg-ev-text">
                <span className="lg-ev-meta">Agenda · hoje</span>
                <span className="lg-ev-title">Consulta confirmada</span>
                <span className="lg-ev-sub">Retorno de manutenção · 14h30</span>
              </span>
            </li>
            <li className="lg-ev">
              <span className="lg-ev-ico red"><Icon name="wallet" size={17} /></span>
              <span className="lg-ev-text">
                <span className="lg-ev-meta">Financeiro · agora</span>
                <span className="lg-ev-title">Parcela em atraso</span>
                <span className="lg-ev-sub">Lembrete pronto para o WhatsApp</span>
              </span>
              <span className="lg-ev-badge">Cobrar</span>
            </li>
            <li className="lg-ev is-ghost">
              <span className="lg-ev-ico green"><Icon name="check" size={17} /></span>
              <span className="lg-ev-text">
                <span className="lg-ev-meta">Ficha · 15h10</span>
                <span className="lg-ev-title">Evolução registrada</span>
                <span className="lg-ev-sub">Odontograma atualizado</span>
              </span>
            </li>
          </ol>
        </section>

        <div className="lg-card">{children}</div>
      </main>

      <footer className="lg-foot">
        <span>Acesso restrito à equipe. Os dados dos pacientes só carregam depois da entrada.</span>
        <span>© {new Date().getFullYear()} {BRAND.clinic} · {BRAND.city}</span>
      </footer>
    </div>
  )
}
