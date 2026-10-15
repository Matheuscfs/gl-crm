// Cópia de src/lib/pix.ts para as Edge Functions (Deno não enxerga src/). Mantenha as duas iguais.
/**
 * PIX "copia e cola" (BR Code estático, padrão EMV do Bacen).
 * Gerado no cliente a partir da chave PIX da clínica — sem PSP nem API externa.
 */

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`

/** Remove acentos e caracteres fora do padrão EMV; limita o comprimento. */
const emvText = (s: string, max: number) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .-]/g, '').trim().slice(0, max) || 'N/A'

/** CRC16-CCITT (polinômio 0x1021, inicial 0xFFFF) exigido pelo BR Code. */
function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export interface PixParams {
  /** Chave PIX (CPF/CNPJ, e-mail, telefone ou aleatória). */
  key: string
  /** Nome do recebedor (até 25 caracteres no BR Code). */
  name: string
  /** Cidade do recebedor (até 15 caracteres). */
  city: string
  /** Valor em reais; omitido → o pagador digita o valor. */
  amount?: number
  /** Identificador da transação (até 25 caracteres alfanuméricos). */
  txid?: string
}

/** Monta o payload "copia e cola" (também serve para gerar QR Code). */
export function pixPayload({ key, name, city, amount, txid }: PixParams): string {
  const merchantAccount = tlv('00', 'br.gov.bcb.pix') + tlv('01', key.trim())
  const id = (txid ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  const body =
    tlv('00', '01') +
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '986') +
    (amount && amount > 0 ? tlv('54', amount.toFixed(2)) : '') +
    tlv('58', 'BR') +
    tlv('59', emvText(name, 25)) +
    tlv('60', emvText(city, 15)) +
    tlv('62', tlv('05', id)) +
    '6304'
  return body + crc16(body)
}
