import { describe, expect, test } from 'vitest'
import { pixPayload } from '../src/lib/pix.ts'

/** Splits an EMV payload into its top-level id → value fields, checking every length prefix. */
function parseTlv(payload: string): Map<string, string> {
  const fields = new Map<string, string>()
  let i = 0
  while (i < payload.length) {
    const id = payload.slice(i, i + 2)
    const len = Number(payload.slice(i + 2, i + 4))
    fields.set(id, payload.slice(i + 4, i + 4 + len))
    i += 4 + len
  }
  expect(i).toBe(payload.length)
  return fields
}

describe('pixPayload', () => {
  test('reproduces the static BR Code example from the Bacen Pix manual, CRC included', () => {
    const payload = pixPayload({ key: '123e4567-e12b-12d1-a456-426655440000', name: 'Fulano de Tal', city: 'BRASILIA' })
    expect(payload).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
    )
  })

  test('writes the amount with two decimals when there is one', () => {
    const fields = parseTlv(pixPayload({ key: 'clinica@exemplo.com', name: 'Clinica', city: 'Cascavel', amount: 150.5 }))
    expect(fields.get('54')).toBe('150.50')
  })

  test('leaves the amount out when it is zero or missing, so the payer types it', () => {
    expect(parseTlv(pixPayload({ key: 'k', name: 'N', city: 'C', amount: 0 })).has('54')).toBe(false)
    expect(parseTlv(pixPayload({ key: 'k', name: 'N', city: 'C' })).has('54')).toBe(false)
  })

  test('strips accents and symbols and respects the EMV length limits', () => {
    const fields = parseTlv(
      pixPayload({ key: 'k', name: 'Consultório Odontológico Dra. Gabriela Lorenzi', city: 'São José dos Pinhais' }),
    )
    expect(fields.get('59')).toBe('Consultorio Odontologico ')
    expect(fields.get('59')).toHaveLength(25)
    expect(fields.get('60')).toBe('Sao Jose dos Pi')
  })

  test('sanitises the transaction id and falls back to ***', () => {
    const withTxid = parseTlv(pixPayload({ key: 'k', name: 'N', city: 'C', txid: 'parcela-2/3 #ana' }))
    expect(withTxid.get('62')).toBe('0512parcela23ana')
    const longTxid = parseTlv(pixPayload({ key: 'k', name: 'N', city: 'C', txid: 'x'.repeat(40) }))
    expect(longTxid.get('62')).toBe(`0525${'x'.repeat(25)}`)
    expect(parseTlv(pixPayload({ key: 'k', name: 'N', city: 'C', txid: '---' })).get('62')).toBe('0503***')
  })

  test('always ends with a 4-digit hexadecimal CRC', () => {
    expect(pixPayload({ key: ' 45999990000 ', name: 'N', city: 'C', amount: 99.9 })).toMatch(/6304[0-9A-F]{4}$/)
  })
})
