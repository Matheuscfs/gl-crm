/* Máscaras e validação de CPF e telefone (pt-BR). */

/** Aplica a máscara 000.000.000-00 enquanto digita. */
export function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  let out = d.slice(0, 3)
  if (d.length > 3) out += '.' + d.slice(3, 6)
  if (d.length > 6) out += '.' + d.slice(6, 9)
  if (d.length > 9) out += '-' + d.slice(9, 11)
  return out
}

/** Valida CPF pelos dígitos verificadores. Vazio conta como válido (campo opcional). */
export function validCpf(v: string): boolean {
  const d = v.replace(/\D/g, '')
  if (!d) return true
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

/** Aplica a máscara (00) 0000-0000 / (00) 90000-0000 enquanto digita. */
export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (!d) return ''
  let out = '(' + d.slice(0, 2)
  if (d.length > 2) out += ') ' + (d.length > 10 ? d.slice(2, 7) : d.slice(2, 6))
  if (d.length > 6) out += '-' + (d.length > 10 ? d.slice(7, 11) : d.slice(6, 10))
  return out
}

/** Telefone válido = vazio (opcional) ou 10/11 dígitos. */
export function validPhone(v: string): boolean {
  const d = v.replace(/\D/g, '')
  return !d || d.length === 10 || d.length === 11
}
