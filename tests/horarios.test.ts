import { describe, expect, test } from 'vitest'
import { dayRange, type HorarioDia } from '../src/lib/horarios.ts'

// Index 0 is Monday, 6 is Sunday. 2026-10-26 is a Monday.
const MONDAY = '2026-10-26'
const SATURDAY = '2026-10-31'
const SUNDAY = '2026-11-01'

function week(monday: string, overrides: Partial<Record<number, Partial<HorarioDia>>> = {}): HorarioDia[] {
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
  return days.map((day, i) => ({ day, hours: i < 5 ? monday : '08:00 – 12:00', closed: i === 6, ...overrides[i] }))
}

describe('dayRange', () => {
  test('reads the default format and picks the right weekday', () => {
    const horarios = week('08:00 – 18:00')
    expect(dayRange(horarios, MONDAY)).toEqual({ start: 8, end: 18 })
    expect(dayRange(horarios, SATURDAY)).toEqual({ start: 8, end: 12 })
  })

  test('returns null on a closed day', () => {
    expect(dayRange(week('08:00 – 18:00'), SUNDAY)).toBeNull()
  })

  test('handles half hours', () => {
    expect(dayRange(week('08:30 – 17:45'), MONDAY)).toEqual({ start: 8.5, end: 17.75 })
  })

  test('spans a lunch break from first opening to last closing', () => {
    expect(dayRange(week('08:00 – 12:00 / 14:00 – 18:00'), MONDAY)).toEqual({ start: 8, end: 18 })
    expect(dayRange(week('8h às 12h e 13h30 às 19h'), MONDAY)).toEqual({ start: 8, end: 19 })
  })

  test('accepts the usual ways people type opening hours', () => {
    expect(dayRange(week('8h às 18h'), MONDAY)).toEqual({ start: 8, end: 18 })
    expect(dayRange(week('8h30-17h'), MONDAY)).toEqual({ start: 8.5, end: 17 })
    expect(dayRange(week('8 a 12'), MONDAY)).toEqual({ start: 8, end: 12 })
    expect(dayRange(week('08:00—18:00'), MONDAY)).toEqual({ start: 8, end: 18 })
  })

  test('returns null for text it cannot read or a range that ends before it starts', () => {
    expect(dayRange(week('Fechado'), MONDAY)).toBeNull()
    expect(dayRange(week('18:00 – 08:00'), MONDAY)).toBeNull()
  })
})
