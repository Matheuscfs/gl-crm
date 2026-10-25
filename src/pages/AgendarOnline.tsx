import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { LogoAnimada } from '../components/LogoAnimada'
import { BRAND } from '../brand'
import { addDays, todayISO, parseISO } from '../lib/dates'
import { fmtHour } from '../data'
import { maskPhone } from '../lib/masks'

interface Livre { dia: string; hora: number }
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MOTIVOS = ['Primeira consulta', 'Revisão / retorno', 'Dor ou urgência', 'Avaliação estética', 'Outro']

/**
 * Página pública de agendamento (sem login). Mostra só os horários livres — nada da agenda nem dos
 * pacientes aparece — e grava um PEDIDO, que a clínica confirma (Agenda → Pedidos online).
 * Usa duas funções do banco liberadas para o público (migração 0026): horarios_livres e
 * solicitar_agendamento, que revalida o horário e limita pedidos por telefone.
 */
export default function AgendarOnline() {
  const [livres, setLivres] = useState<Livre[] | null>(null)
  const [erroCarga, setErroCarga] = useState('')
  const [dia, setDia] = useState('')
  const [hora, setHora] = useState<number | null>(null)
  const [f, setF] = useState({ responsavel: '', telefone: '', paciente: '', nascimento: '', motivo: MOTIVOS[0], obs: '' })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)

  const carregar = () => {
    if (!supabase) { setErroCarga('Agendamento online indisponível no momento.'); setLivres([]); return }
    supabase.rpc('horarios_livres', { de: addDays(todayISO(), 1), ate: addDays(todayISO(), 21) }).then(({ data, error }) => {
      if (error) { setErroCarga('Não foi possível carregar os horários agora. Tente de novo em instantes ou chame a clínica no WhatsApp.'); setLivres([]); return }
      const lista = ((data ?? []) as { dia: string; hora: number | string }[]).map((r) => ({ dia: r.dia.slice(0, 10), hora: Number(r.hora) }))
      setLivres(lista)
      setDia((d) => d || lista[0]?.dia || '')
    })
  }
  useEffect(carregar, [])

  const dias = useMemo(() => [...new Set((livres ?? []).map((l) => l.dia))], [livres])
  const horas = (livres ?? []).filter((l) => l.dia === dia).map((l) => l.hora)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!dia || hora === null) return setErro('Escolha o dia e o horário.')
    if (!f.responsavel.trim() || !f.paciente.trim()) return setErro('Informe o seu nome e o nome do paciente.')
    if (f.telefone.replace(/\D/g, '').length < 10) return setErro('Informe um WhatsApp com DDD.')
    if (!supabase) return
    setEnviando(true)
    const { error } = await supabase.rpc('solicitar_agendamento', {
      p_responsavel: f.responsavel.trim(), p_telefone: f.telefone, p_paciente: f.paciente.trim(), p_nascimento: f.nascimento || null,
      p_data: dia, p_hora: hora, p_procedimento: f.motivo, p_observacao: f.obs.trim() || null,
    })
    setEnviando(false)
    if (error) {
      setErro(error.message.replace(/^.*?ERROR:\s*/i, ''))
      if (/não está mais livre/i.test(error.message)) { setHora(null); carregar() }
      return
    }
    setOk(true)
  }

  const rotuloDia = (iso: string) => { const d = parseISO(iso); return { semana: DIAS[d.getDay()], dia: d.getDate(), mes: MESES[d.getMonth()] } }

  return (
    <div className="login-bg login-page agendar-page">
      <header className="lg-top"><LogoAnimada className="lg-logo" /></header>
      <main className="agendar-main">
        {ok ? (
          <section className="lg-card agendar-card" role="status">
            <h1 className="lg-card-title">Pedido enviado!</h1>
            <p className="lg-card-sub">
              Recebemos o pedido para <b>{fmtHour(hora ?? 0)}</b> de {dia && `${rotuloDia(dia).dia} de ${rotuloDia(dia).mes}`}. A equipe da {BRAND.dentist} confirma pelo WhatsApp {f.telefone}.
            </p>
            <button className="lg-link" onClick={() => { setOk(false); setHora(null); setF({ ...f, paciente: '', nascimento: '', obs: '' }); carregar() }}>Fazer outro pedido</button>
          </section>
        ) : (
          <form className="lg-card agendar-card" onSubmit={enviar} noValidate>
            <div>
              <h1 className="lg-card-title">Agende uma consulta</h1>
              <p className="lg-card-sub">Escolha um horário livre. A clínica confirma o agendamento pelo WhatsApp.</p>
            </div>

            {livres === null && <p className="lg-card-sub">Carregando horários…</p>}
            {erroCarga && <div className="lg-msg erro" role="alert">{erroCarga}</div>}
            {livres && livres.length === 0 && !erroCarga && <div className="lg-msg erro">Sem horários livres nas próximas semanas. Chame a clínica no WhatsApp.</div>}

            {dias.length > 0 && (
              <>
                <div className="lg-field">
                  <span className="lg-label">Dia</span>
                  <div className="agendar-dias" role="group" aria-label="Dias com horário livre">
                    {dias.map((d) => { const r = rotuloDia(d); return (
                      <button key={d} type="button" aria-pressed={d === dia} onClick={() => { setDia(d); setHora(null) }}>
                        <span>{r.semana}</span><b>{r.dia}</b><span>{r.mes}</span>
                      </button>
                    ) })}
                  </div>
                </div>
                <div className="lg-field">
                  <span className="lg-label">Horário</span>
                  <div className="agendar-horas" role="group" aria-label="Horários livres">
                    {horas.map((h) => <button key={h} type="button" aria-pressed={h === hora} onClick={() => setHora(h)}>{fmtHour(h)}</button>)}
                  </div>
                </div>
                <div className="lg-field">
                  <label className="lg-label" htmlFor="ag-resp">Seu nome</label>
                  <input id="ag-resp" className="lg-input" autoComplete="name" value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} />
                </div>
                <div className="lg-field">
                  <label className="lg-label" htmlFor="ag-tel">WhatsApp</label>
                  <input id="ag-tel" className="lg-input" type="tel" inputMode="tel" autoComplete="tel" value={f.telefone} onChange={(e) => setF({ ...f, telefone: maskPhone(e.target.value) })} placeholder="(45) 99999-0000" />
                </div>
                <div className="lg-field">
                  <label className="lg-label" htmlFor="ag-pac">Nome do paciente</label>
                  <input id="ag-pac" className="lg-input" value={f.paciente} onChange={(e) => setF({ ...f, paciente: e.target.value })} placeholder="Se for você, repita o seu nome" />
                </div>
                <div className="lg-field">
                  <label className="lg-label" htmlFor="ag-nasc">Data de nascimento do paciente (opcional)</label>
                  <input id="ag-nasc" className="lg-input" type="date" max={todayISO()} value={f.nascimento} onChange={(e) => setF({ ...f, nascimento: e.target.value })} />
                </div>
                <div className="lg-field">
                  <label className="lg-label" htmlFor="ag-motivo">Motivo</label>
                  <select id="ag-motivo" className="lg-input" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })}>{MOTIVOS.map((m) => <option key={m}>{m}</option>)}</select>
                </div>
                <div className="lg-field">
                  <label className="lg-label" htmlFor="ag-obs">Observação (opcional)</label>
                  <textarea id="ag-obs" className="lg-input agendar-obs" rows={2} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} />
                </div>
                {erro && <div className="lg-msg erro" role="alert">{erro}</div>}
                <button type="submit" className="btn btn-primary btn-md btn-block lg-submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Pedir horário'}</button>
                <p className="lg-note">Seus dados são usados só para o agendamento, conforme a LGPD.</p>
              </>
            )}
          </form>
        )}
      </main>
      <footer className="lg-foot"><span>{BRAND.clinic} · {BRAND.city}</span></footer>
    </div>
  )
}
