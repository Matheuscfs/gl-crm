import { useState, type FormEvent } from 'react'
import { Button } from '../components/Button'
import { Field, TextInput } from '../components/Field'
import { useAuth } from '../lib/auth'
import { BRAND } from '../brand'

/** Entrada do consultório — sem sessão, nada do CRM é carregado. */
export default function Login() {
  const { signIn, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [esqueci, setEsqueci] = useState(false)

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    setAviso('')
    if (!email.trim() || !senha) return setErro('Preencha e-mail e senha.')
    setEntrando(true)
    const msg = await signIn(email, senha)
    setEntrando(false)
    if (msg) setErro(msg)
  }

  const recuperar = async () => {
    setErro('')
    setAviso('')
    if (!email.trim()) return setErro('Digite o e-mail para receber o link de redefinição.')
    setEntrando(true)
    const msg = await resetPassword(email)
    setEntrando(false)
    if (msg) setErro(msg)
    else setAviso(`Link de redefinição enviado para ${email.trim()}.`)
  }

  return (
    <div className="login-bg">
      <form className="login-card" onSubmit={entrar}>
        <img src="/logo-gl.png" alt={BRAND.name} className="login-logo" />
        <div className="login-title">Acesso ao consultório</div>
        <div className="login-sub">Agenda, prontuário e financeiro da {BRAND.dentist}</div>

        <Field label="E-mail">
          <TextInput
            type="email"
            autoFocus
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@clinica.com.br"
          />
        </Field>

        {!esqueci && (
          <Field label="Senha">
            <TextInput
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
        )}

        {erro && <div className="login-msg erro">{erro}</div>}
        {aviso && <div className="login-msg ok">{aviso}</div>}

        {esqueci ? (
          <>
            <Button type="button" block loading={entrando} onClick={recuperar}>Enviar link de redefinição</Button>
            <button type="button" className="login-link" onClick={() => { setEsqueci(false); setErro(''); setAviso('') }}>
              Voltar para o login
            </button>
          </>
        ) : (
          <>
            <Button type="submit" block loading={entrando}>Entrar</Button>
            <button type="button" className="login-link" onClick={() => { setEsqueci(true); setErro(''); setAviso('') }}>
              Esqueci minha senha
            </button>
          </>
        )}

        <div className="login-foot">
          Acesso restrito à equipe. Os dados dos pacientes só são carregados após a entrada.
        </div>
      </form>
    </div>
  )
}
