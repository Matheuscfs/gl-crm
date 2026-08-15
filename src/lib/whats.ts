import type { Patient } from '../data'

/** Monta o link wa.me com a mensagem; null se o telefone estiver vazio. */
export function waLink(phone: string | undefined, msg: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  const full = digits.length <= 11 ? `55${digits}` : digits
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`
}

/** Casa o nome curto da agenda ("Helena S.") com o cadastro completo do paciente. */
export function findPatientByName(patients: Patient[], name: string): Patient | undefined {
  const norm = name.trim().toLowerCase()
  if (!norm) return undefined
  const exact = patients.find((x) => x.name.toLowerCase() === norm)
  if (exact) return exact
  const toks = norm.replace(/\./g, '').split(/\s+/)
  return patients.find((x) => {
    const xt = x.name.toLowerCase().split(/\s+/)
    return xt[0] === toks[0] && (!toks[1] || (xt[1] ?? '').startsWith(toks[1]))
  })
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
