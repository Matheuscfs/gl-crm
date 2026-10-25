import { describe, expect, test } from 'vitest'
import { maskCpf, maskPhone, validCpf, validPhone } from '../src/lib/masks.ts'

describe('CPF', () => {
  test('masks while the user types', () => {
    expect(maskCpf('529')).toBe('529')
    expect(maskCpf('5299')).toBe('529.9')
    expect(maskCpf('5299822')).toBe('529.982.2')
    expect(maskCpf('52998224725')).toBe('529.982.247-25')
    expect(maskCpf('529.982.247-2599')).toBe('529.982.247-25')
  })

  test('accepts a CPF whose check digits match', () => {
    expect(validCpf('529.982.247-25')).toBe(true)
    expect(validCpf('52998224725')).toBe(true)
  })

  test('rejects wrong check digits, wrong length and repeated digits', () => {
    expect(validCpf('529.982.247-24')).toBe(false)
    expect(validCpf('529.982.247')).toBe(false)
    expect(validCpf('111.111.111-11')).toBe(false)
  })

  test('treats an empty field as valid because CPF is optional', () => {
    expect(validCpf('')).toBe(true)
  })
})

describe('phone', () => {
  test('masks landlines and mobiles', () => {
    expect(maskPhone('4532221111')).toBe('(45) 3222-1111')
    expect(maskPhone('45984157928')).toBe('(45) 98415-7928')
  })

  test('masks partial input without jumping ahead', () => {
    expect(maskPhone('')).toBe('')
    expect(maskPhone('4')).toBe('(4')
    expect(maskPhone('459')).toBe('(45) 9')
    expect(maskPhone('4598415')).toBe('(45) 9841-5')
  })

  test('accepts 10 or 11 digits, or nothing', () => {
    expect(validPhone('(45) 3222-1111')).toBe(true)
    expect(validPhone('(45) 98415-7928')).toBe(true)
    expect(validPhone('')).toBe(true)
    expect(validPhone('9841-5792')).toBe(false)
  })
})
