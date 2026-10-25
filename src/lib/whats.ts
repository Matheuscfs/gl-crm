import type { Patient } from '../data'

/** Monta o link wa.me com a mensagem; null se o telefone estiver vazio. */
export function waLink(phone: string | undefined, msg: string): string | null {
  // "045 98415-7928": o zero de discagem interurbana não faz parte do número internacional
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return null
  const full = digits.length <= 11 ? `55${digits}` : digits
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`
}

/**
 * Casa o nome curto da agenda ("Helena S.") com o cadastro completo do paciente.
 * Só devolve quando há um único candidato: com duas "Helena" o link do WhatsApp poderia
 * ir para a família errada, então nesse caso não casa (a tela pede para abrir a ficha).
 */
export function findPatientByName<P extends Patient>(patients: P[], name: string): P | undefined {
  const norm = name.trim().toLowerCase()
  if (!norm) return undefined
  const exatos = patients.filter((x) => x.name.trim().toLowerCase() === norm)
  if (exatos.length) return exatos.length === 1 ? exatos[0] : undefined
  const toks = norm.replace(/\./g, '').split(/\s+/)
  const candidatos = patients.filter((x) => {
    const xt = x.name.toLowerCase().split(/\s+/)
    return xt[0] === toks[0] && (!toks[1] || (xt[1] ?? '').startsWith(toks[1]))
  })
  return candidatos.length === 1 ? candidatos[0] : undefined
}

/** Paciente de um agendamento: pelo id gravado no agendamento; os antigos só têm o nome. */
export function findPatientForEvent<P extends Patient>(patients: P[], ev: { patientId?: string; child: string }): P | undefined {
  return (ev.patientId ? patients.find((p) => p._id === ev.patientId) : undefined) ?? findPatientByName(patients, ev.child)
}

/** Telefone preferido para contato: responsável (pediátrico) ou o próprio paciente. */
export function contactPhone(p?: Patient): string {
  if (!p) return ''
  return (p.respPhone?.trim() || p.phone?.trim()) ?? ''
}

/** Primeiro nome do responsável ("Carla Andrade · mãe" → "Carla Andrade") ou o do paciente. */
export function contactName(p?: Patient, fallback = ''): string {
  if (!p) return fallback
  const resp = (p.resp ?? '').split('·')[0].trim()
  return resp && resp !== '—' ? resp : p.name || fallback
}
