import { describe, expect, test } from 'vitest'
import {
  addDays,
  addMonths,
  brDate,
  brToIso,
  diffDays,
  idadeAnos,
  maskBr,
  mondayOf,
  parseBr,
  parseISO,
  primeiroVencimento,
  weekRangeLabel,
} from '../src/lib/dates.ts'

describe('addMonths', () => {
  test('clamps to the last day of a shorter month instead of overflowing', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29') // leap year
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30')
  })

  test('crosses the year boundary and keeps ordinary days', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
    expect(addMonths('2026-05-10', 0)).toBe('2026-05-10')
  })
})

describe('day arithmetic', () => {
  test('addDays crosses months and years', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  test('diffDays counts calendar days in either direction', () => {
    expect(diffDays('2026-10-01', '2026-10-25')).toBe(24)
    expect(diffDays('2026-10-25', '2026-10-01')).toBe(-24)
  })

  test('mondayOf returns the Monday of the same week, Sunday included', () => {
    expect(mondayOf(parseISO('2026-10-28'))).toBe('2026-10-26') // Wednesday
    expect(mondayOf(parseISO('2026-10-26'))).toBe('2026-10-26') // Monday
    expect(mondayOf(parseISO('2026-10-25'))).toBe('2026-10-19') // Sunday belongs to the week before
  })

  test('the first installment is due on the 5th of the next month', () => {
    expect(primeiroVencimento('2026-10-25')).toBe('2026-11-05')
    expect(primeiroVencimento('2026-12-02')).toBe('2027-01-05')
  })
})

describe('Brazilian date format', () => {
  test('converts between ISO and dd/mm/aaaa', () => {
    expect(brDate('2026-10-05')).toBe('05/10/2026')
    expect(brToIso('05/10/2026')).toBe('2026-10-05')
    expect(brDate('not a date')).toBe('')
    expect(brToIso('5/10/26')).toBe('')
  })

  test('parseBr accepts short forms and rejects impossible dates', () => {
    expect(parseBr('5/1/26')).toBe('2026-01-05')
    expect(parseBr(' 29/02/2028 ')).toBe('2028-02-29')
    expect(parseBr('29/02/2026')).toBeNull()
    expect(parseBr('31/04/2026')).toBeNull()
    expect(parseBr('12/13/2026')).toBeNull()
    expect(parseBr('ontem')).toBeNull()
  })

  test('maskBr inserts slashes while the user types', () => {
    expect(maskBr('2')).toBe('2')
    expect(maskBr('251')).toBe('25/1')
    expect(maskBr('25102026')).toBe('25/10/2026')
    expect(maskBr('25/10/2026 99')).toBe('25/10/2026')
  })
})

describe('labels and ages', () => {
  test('week range label covers same month, month change and year change', () => {
    expect(weekRangeLabel('2026-10-19')).toBe('19 – 24 de outubro de 2026')
    expect(weekRangeLabel('2026-09-28')).toBe('28 set – 3 out 2026')
    expect(weekRangeLabel('2026-12-28')).toBe('28 dez 2026 – 2 jan 2027')
  })

  test('age only increases on or after the birthday', () => {
    const hoje = parseISO('2026-10-25')
    expect(idadeAnos('2019-10-25', hoje)).toBe(7)
    expect(idadeAnos('2019-10-26', hoje)).toBe(6)
    expect(idadeAnos('2027-01-01', hoje)).toBeNull()
    expect(idadeAnos('', hoje)).toBeNull()
  })
})
