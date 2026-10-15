import type { Patient } from '../data'
import { BRAND } from '../brand'
import { contactName } from './whats'

/* Textos de WhatsApp usados pelo Início, pela Agenda e por Pacientes — um lugar só. */

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome

/** Paciente infantil com responsável cadastrado: a mensagem vai para o responsável. */
export const ehCrianca = (p?: Patient) => !!p && p.perfil !== 'estetico' && p.perfil !== 'adulto' && !!p.resp && p.resp !== '—'

export function msgRetorno(p: Patient): string {
  const quem = contactName(p, p.name)
  return `Oi, ${quem}! Aqui é do consultório da ${BRAND.dentist}. ${ehCrianca(p) ? `Está na hora do retorno de ${primeiroNome(p.name)}` : 'Está na hora do seu retorno'}. Quer que a gente reserve um horário?`
}

export function msgRetoque(p: Patient, meses: number): string {
  return `Oi, ${primeiroNome(p.name)}! Já faz ${meses} meses do seu último procedimento com a ${BRAND.dentist}. Quer agendar uma reavaliação?`
}

export function msgAniversario(p: Patient): string {
  const quem = contactName(p, p.name)
  return `Oi, ${quem}! A ${BRAND.dentist} e toda a equipe desejam um feliz aniversário ${ehCrianca(p) ? `para ${primeiroNome(p.name)}` : 'para você'}! 🎉`
}

/** Confirmação de consulta; `quando` vem pronto ("hoje", "amanhã", "em 16/10/2026"). */
export function msgConfirmacao(nomeAgenda: string, p: Patient | undefined, quando: string, hora: string, proc: string, pediatrico: boolean): string {
  const quem = contactName(p, nomeAgenda)
  const consulta = pediatrico && p?.resp && p.resp !== '—' ? `a consulta de ${primeiroNome(nomeAgenda)}` : 'sua consulta'
  return `Oi, ${quem}! 😊 Passando para confirmar ${consulta} com a ${BRAND.dentist} ${quando} às ${hora} (${proc || 'consulta'}). Responda SIM para confirmar ou REMARCAR se precisar mudar. 🦷`
}
