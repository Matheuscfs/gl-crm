import { describe, expect, test } from 'vitest'
import { bomFor, PROC_BOM } from '../src/lib/bom.ts'

describe('bomFor', () => {
  test('finds the bill of materials by exact name, ignoring case', () => {
    expect(bomFor('Selante')).toBe(PROC_BOM['Selante'])
    expect(bomFor('pulpotomia')).toBe(PROC_BOM['Pulpotomia'])
  })

  test('matches a procedure written with extra detail, like the tooth', () => {
    expect(bomFor('Restauração em resina composta (74 O)')).toBe(PROC_BOM['Restauração em resina'])
    expect(bomFor('Extração do 55')).toBe(PROC_BOM['Extração'])
  })

  test('matches a shorter name contained in a procedure', () => {
    expect(bomFor('Clareamento')).toBe(PROC_BOM['Clareamento de consultório'])
  })

  test('returns null for blank names instead of the first bill on the list', () => {
    expect(bomFor('')).toBeNull()
    expect(bomFor('   ')).toBeNull()
    expect(bomFor('(74 O)')).toBeNull()
  })

  test('returns null for an unknown procedure', () => {
    expect(bomFor('Ortodontia')).toBeNull()
  })
})
