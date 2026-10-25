/**
 * Regras da automação do GL CRM — o QUE enviar e PARA QUEM, sem rede nem banco.
 * Usado pela Edge Function `automacao` (Deno) e testado no Node (tests/automacao.test.ts).
 *
 * Horário: o consultório é em Cascavel-PR (UTC−3, sem horário de verão desde 2019). As datas
 * dos registros vêm em ISO (aaaa-mm-dd) ou no formato do app (dd/mm/aaaa).
 */

export interface Config {
  whatsapp_ativo: boolean
  confirmacao_horas: number
  cobranca_dias: number[]
  retorno_meses_ped: number
  retoque_meses_est: number
  aniversario: boolean
  pos_atendimento: boolean
  estoque_alerta: boolean
  validade_dias: number
  telefone_alertas: string | null
}

export const CONFIG_PADRAO: Config = {
  whatsapp_ativo: false, confirmacao_horas: 24, cobranca_dias: [-3, 0, 3], retorno_meses_ped: 6, retoque_meses_est: 4,
  aniversario: true, pos_atendimento: true, estoque_alerta: true, validade_dias: 30, telefone_alertas: null,
}

export interface Paciente {
  id: string; name: string; perfil?: string | null; resp?: string | null; phone?: string | null; resp_phone?: string | null
  birthdate?: string | null; next?: string | null; last?: string | null
}
export interface Agendamento {
  id: string; patient_id?: string | null; child: string; date: string; start: number; status: string; proc?: string | null; cobrado_em?: string | null
}
export interface Parcela {
  id: string; patient_id?: string | null; resp?: string | null; ref?: string | null; venc: string; val: string; status: string; cobranca_link?: string | null
}
export interface ItemEstoque { item: string; qtd: number | string; min: number | string; validade?: string | null; un?: string | null }
export interface JaEnviada { tipo: string; appointment_id?: string | null; installment_id?: string | null; patient_id?: string | null; ref_dia: string }

export type Tipo = 'confirmacao' | 'lembrete_retorno' | 'retoque' | 'cobranca' | 'aniversario' | 'pos_atendimento' | 'estoque'

export interface Envio {
  tipo: Tipo
  template: string
  parametros: string[]
  /** Texto equivalente (para o histórico e para quem lê no app). */
  corpo: string
  telefone: string
  ref_dia: string
  patient_id?: string
  appointment_id?: string
  installment_id?: string
}

export interface Clinica { dentista: string; nome: string; linkAvaliacao?: string; pix?: (valor: number, txid: string) => string | null }

/* ---------- datas ---------- */
const p2 = (n: number) => String(n).padStart(2, '0')
/** "Agora" no fuso de Brasília como data/hora de parede (sem depender do fuso do servidor). */
export function agoraBRT(utc: Date = new Date()) {
  const t = new Date(utc.getTime() - 3 * 3600_000)
  return { iso: `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`, hora: t.getUTCHours() + t.getUTCMinutes() / 60, mes: t.getUTCMonth() + 1, dia: t.getUTCDate() }
}
/** dd/mm/aaaa ou aaaa-mm-dd → aaaa-mm-dd ('' se inválida). */
export function isoDe(s?: string | null): string {
  if (!s) return ''
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''
}
const diaUTC = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
export const diasEntre = (de: string, ate: string) => Math.round((diaUTC(ate) - diaUTC(de)) / 86_400_000)
export function somaDias(iso: string, n: number) {
  const d = new Date(diaUTC(iso) + n * 86_400_000)
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`
}
export function somaMeses(iso: string, n: number) {
  const a = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)) - 1 + n, d = Number(iso.slice(8, 10))
  const ano = a + Math.floor(m / 12), mes = ((m % 12) + 12) % 12
  const ult = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
  return `${ano}-${p2(mes + 1)}-${p2(Math.min(d, ult))}`
}
const brData = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const diaSemana = (iso: string) => DIAS[new Date(diaUTC(iso)).getUTCDay()]
export const hora = (h: number) => `${p2(Math.floor(h))}:${p2(Math.round((h - Math.floor(h)) * 60))}`

/* ---------- contato ---------- */
const primeiro = (s: string) => s.trim().split(/\s+/)[0] ?? s
const nomeResp = (p: Paciente) => (p.resp ?? '').split('·')[0].trim()
const ehCrianca = (p: Paciente) => (p.perfil ?? 'pediatrico') === 'pediatrico' && !!nomeResp(p) && nomeResp(p) !== '—'

/** Telefone com DDI 55 (só dígitos), ou '' se não houver um válido. */
export function telefoneE164(...candidatos: (string | null | undefined)[]): string {
  for (const c of candidatos) {
    const d = (c ?? '').replace(/\D/g, '')
    if (d.length === 10 || d.length === 11) return `55${d}`
    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d
  }
  return ''
}
const contato = (p: Paciente) => ehCrianca(p)
  ? { nome: primeiro(nomeResp(p)), tel: telefoneE164(p.resp_phone, p.phone) }
  : { nome: primeiro(p.name), tel: telefoneE164(p.phone, p.resp_phone) }

const parseValor = (s: string) => {
  const t = s.replace(/[^\d.,]/g, '')
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : 0
}
const moeda = (n: number) => `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

/* ---------- planejamento ---------- */

/**
 * Decide as mensagens a enviar agora. Não repete: cada tipo sai uma vez por agendamento/parcela
 * (parcela: uma vez por dia da régua) e por paciente no período. Só entre 8h e 20h.
 */
export function planejarEnvios(
  dados: { pacientes: Paciente[]; agendamentos: Agendamento[]; parcelas: Parcela[]; estoque: ItemEstoque[]; jaEnviadas: JaEnviada[] },
  cfg: Config,
  clinica: Clinica,
  agoraUtc: Date = new Date(),
): Envio[] {
  const { iso: hoje, hora: agoraH } = agoraBRT(agoraUtc)
  if (!cfg.whatsapp_ativo || agoraH < 8 || agoraH >= 20) return []
  const envios: Envio[] = []
  const porPaciente = new Map(dados.pacientes.map((p) => [p.id, p]))
  const enviado = (f: (j: JaEnviada) => boolean) => dados.jaEnviadas.some(f)
  const agendaFutura = (pid: string) => dados.agendamentos.some((a) => a.patient_id === pid && a.date >= hoje && !['desmarcado', 'faltou'].includes(a.status))

  // 1. confirmação: agendamentos sem confirmação dentro da janela (padrão: 24 h antes)
  for (const a of dados.agendamentos) {
    if (a.status !== 'agendado' || !a.date) continue
    const horasAte = diasEntre(hoje, a.date) * 24 + (Number(a.start) - agoraH)
    if (horasAte <= 0 || horasAte > cfg.confirmacao_horas) continue
    if (enviado((j) => j.tipo === 'confirmacao' && j.appointment_id === a.id)) continue
    const p = a.patient_id ? porPaciente.get(a.patient_id) : undefined
    const c = p ? contato(p) : null
    if (!c?.tel) continue
    const quando = a.date === hoje ? 'hoje' : a.date === somaDias(hoje, 1) ? `amanhã (${diaSemana(a.date)}, ${brData(a.date)})` : `${diaSemana(a.date)}, ${brData(a.date)}`
    const quem = p && ehCrianca(p) ? `a consulta de ${primeiro(p.name)}` : 'sua consulta'
    const params = [c.nome, quem, clinica.dentista, quando, hora(Number(a.start))]
    envios.push({
      tipo: 'confirmacao', template: 'confirmacao_consulta', parametros: params, telefone: c.tel, ref_dia: hoje, patient_id: p!.id, appointment_id: a.id,
      corpo: `Olá, ${params[0]}! Lembrando ${params[1]} com a ${params[2]} ${params[3]} às ${params[4]}. Responda 1 para confirmar ou 2 para remarcar.`,
    })
  }

  // 2. cobrança: régua D-3, D0, D+3 (dias configuráveis) para parcela em aberto
  for (const parc of dados.parcelas) {
    if (parc.status === 'pago') continue
    const venc = isoDe(parc.venc)
    if (!venc) continue
    const dias = diasEntre(venc, hoje) // negativo = faltam dias
    if (!cfg.cobranca_dias.includes(dias)) continue
    if (enviado((j) => j.tipo === 'cobranca' && j.installment_id === parc.id && j.ref_dia === hoje)) continue
    const p = parc.patient_id ? porPaciente.get(parc.patient_id) : undefined
    const c = p ? contato(p) : null
    if (!c?.tel) continue
    const valor = parseValor(parc.val)
    const pix = parc.cobranca_link || clinica.pix?.(valor, (parc.ref ?? 'PARCELA').slice(0, 25)) || ''
    const situacao = dias < 0 ? `vence em ${brData(venc)}` : dias === 0 ? 'vence hoje' : `venceu em ${brData(venc)}`
    const params = [c.nome, moeda(valor), parc.ref || 'tratamento', situacao, pix ? `Para pagar: ${pix}` : 'Responda esta mensagem para combinar o pagamento.']
    envios.push({
      tipo: 'cobranca', template: 'lembrete_parcela', parametros: params, telefone: c.tel, ref_dia: hoje, patient_id: p!.id, installment_id: parc.id,
      corpo: `Olá, ${params[0]}! A parcela de ${params[1]} (${params[2]}) ${params[3]}. ${params[4]}`,
    })
  }

  for (const p of dados.pacientes) {
    const c = contato(p)
    if (!c.tel) continue
    const recente = (tipo: Tipo, dias: number) => enviado((j) => j.tipo === tipo && j.patient_id === p.id && diasEntre(j.ref_dia, hoje) < dias)

    // 3. aniversário
    const nasc = isoDe(p.birthdate)
    if (cfg.aniversario && nasc && nasc.slice(5) === hoje.slice(5) && !recente('aniversario', 300)) {
      const quem = ehCrianca(p) ? `${primeiro(p.name)}` : primeiro(p.name)
      envios.push({ tipo: 'aniversario', template: 'aniversario', parametros: [quem, clinica.dentista], telefone: c.tel, ref_dia: hoje, patient_id: p.id,
        corpo: `Feliz aniversário, ${quem}! 🎉 A ${clinica.dentista} e toda a equipe desejam um dia muito especial.` })
    }

    if (agendaFutura(p.id)) continue // quem já tem horário marcado não recebe lembrete de retorno

    // 4. retorno (pediátrico/adulto): data do próximo retorno chegando (7 dias) ou vencida há até 60
    const prox = isoDe(p.next)
    const est = p.perfil === 'estetico'
    if (!est && prox) {
      const d = diasEntre(hoje, prox)
      if (d <= 7 && d >= -60 && !recente('lembrete_retorno', 30)) {
        const quem = ehCrianca(p) ? `de ${primeiro(p.name)}` : 'seu'
        envios.push({ tipo: 'lembrete_retorno', template: 'lembrete_retorno', parametros: [c.nome, quem, clinica.dentista], telefone: c.tel, ref_dia: hoje, patient_id: p.id,
          corpo: `Olá, ${c.nome}! Está na hora do retorno ${quem} com a ${clinica.dentista}. Responda esta mensagem para escolher o melhor horário.` })
      }
    }

    // 5. retoque (estético): N meses desde a última visita
    const ultima = isoDe(p.last)
    if (est && ultima && somaMeses(ultima, cfg.retoque_meses_est) <= hoje && !recente('retoque', 45)) {
      const meses = Math.floor(diasEntre(ultima, hoje) / 30)
      envios.push({ tipo: 'retoque', template: 'lembrete_retoque', parametros: [c.nome, String(meses), clinica.dentista], telefone: c.tel, ref_dia: hoje, patient_id: p.id,
        corpo: `Olá, ${c.nome}! Já faz ${meses} meses do seu último procedimento com a ${clinica.dentista}. Quer agendar a reavaliação?` })
    }
  }

  // 6. pós-atendimento: concluídos hoje
  if (cfg.pos_atendimento) {
    for (const a of dados.agendamentos) {
      if (a.status !== 'concluido' || a.date !== hoje) continue
      if (enviado((j) => j.tipo === 'pos_atendimento' && j.appointment_id === a.id)) continue
      const p = a.patient_id ? porPaciente.get(a.patient_id) : undefined
      const c = p ? contato(p) : null
      if (!c?.tel) continue
      const quem = p && ehCrianca(p) ? primeiro(p.name) : 'você'
      const extra = clinica.linkAvaliacao ? `Se puder, conte como foi: ${clinica.linkAvaliacao}` : 'Qualquer dúvida, é só responder aqui.'
      envios.push({ tipo: 'pos_atendimento', template: 'pos_atendimento', parametros: [c.nome, quem, extra], telefone: c.tel, ref_dia: hoje, patient_id: p!.id, appointment_id: a.id,
        corpo: `Olá, ${c.nome}! Como ${quem} está depois do atendimento de hoje? ${extra}` })
    }
  }

  // 7. estoque: um aviso por dia para a clínica (abaixo do mínimo e validade chegando)
  const telClinica = telefoneE164(cfg.telefone_alertas)
  if (cfg.estoque_alerta && telClinica && !enviado((j) => j.tipo === 'estoque' && j.ref_dia === hoje)) {
    const faltando = dados.estoque.filter((e) => Number(e.min) > 0 && Number(e.qtd) < Number(e.min))
    const vencendo = dados.estoque.filter((e) => { const v = isoDe(e.validade); return !!v && diasEntre(hoje, v) <= cfg.validade_dias })
    if (faltando.length || vencendo.length) {
      const partes = [
        faltando.length ? `comprar: ${faltando.slice(0, 8).map((e) => `${e.item} (${e.qtd}/${e.min})`).join(', ')}${faltando.length > 8 ? ` e mais ${faltando.length - 8}` : ''}` : '',
        vencendo.length ? `validade: ${vencendo.slice(0, 6).map((e) => `${e.item} ${brData(isoDe(e.validade))}`).join(', ')}` : '',
      ].filter(Boolean).join(' · ')
      envios.push({ tipo: 'estoque', template: 'alerta_estoque', parametros: [partes], telefone: telClinica, ref_dia: hoje, corpo: `Estoque da clínica — ${partes}` })
    }
  }
  return envios
}

/* ---------- respostas recebidas ---------- */
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Resposta do paciente à confirmação: botão ("Confirmar"/"Remarcar") ou texto livre. */
export function interpretarResposta(texto: string): 'confirmar' | 'remarcar' | null {
  const t = semAcento(texto).replace(/[!.,]+$/g, '')
  if (/^(1|sim|s|confirmar|confirmo|confirmado|confirma|ok|pode confirmar|estarei|vou sim)\b/.test(t)) return 'confirmar'
  if (/^(2|nao|n|remarcar|remarco|desmarcar|cancelar|nao vou|nao posso|reagendar)\b/.test(t)) return 'remarcar'
  return null
}

/** Confere a assinatura do webhook da Meta (cabeçalho X-Hub-Signature-256). */
export async function assinaturaValida(segredo: string, corpo: string, cabecalho: string | null): Promise<boolean> {
  if (!segredo || !cabecalho?.startsWith('sha256=')) return false
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(corpo)))
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')
  const esperado = cabecalho.slice(7)
  if (esperado.length !== hex.length) return false
  let dif = 0
  for (let i = 0; i < hex.length; i++) dif |= hex.charCodeAt(i) ^ esperado.charCodeAt(i)
  return dif === 0
}
