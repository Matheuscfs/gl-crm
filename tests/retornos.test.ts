import { describe, expect, test } from 'vitest'
import { diasDeRetornoVencido, retornoVencido, rotuloRetornoVencido } from '../src/lib/retornos.ts'
import { patient } from './fixtures.ts'

const HOJE = '2026-10-25'

describe('overdue recalls', () => {
  test('counts the days since the recall date passed', () => {
    expect(diasDeRetornoVencido(patient({ next: '03/10/2026' }), HOJE)).toBe(22)
    expect(retornoVencido(patient({ next: '03/10/2026' }), HOJE)).toBe(true)
  })

  test('is not overdue on the day itself or before it', () => {
    expect(diasDeRetornoVencido(patient({ next: '25/10/2026' }), HOJE)).toBeNull()
    expect(diasDeRetornoVencido(patient({ next: '10/11/2026' }), HOJE)).toBeNull()
  })

  test('falls back to the legacy late flag only when there is no readable date', () => {
    expect(diasDeRetornoVencido(patient({ next: 'em março', late: true }), HOJE)).toBe(0)
    expect(diasDeRetornoVencido(patient({ next: '', late: false }), HOJE)).toBeNull()
    expect(diasDeRetornoVencido(patient({ next: '10/11/2026', late: true }), HOJE)).toBeNull()
  })

  test('labels singular and plural days', () => {
    expect(rotuloRetornoVencido(0)).toBe('Retorno vencido')
    expect(rotuloRetornoVencido(1)).toBe('Vencido há 1 dia')
    expect(rotuloRetornoVencido(22)).toBe('Vencido há 22 dias')
  })
})
