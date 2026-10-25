import { describe, expect, test } from 'vitest'
import { contactName, contactPhone, findPatientByName, findPatientForEvent, waLink } from '../src/lib/whats.ts'
import { msgConfirmacao, msgRetorno } from '../src/lib/mensagens.ts'
import { patient } from './fixtures.ts'

describe('waLink', () => {
  test('adds the Brazil country code to local numbers', () => {
    expect(waLink('(45) 98415-7928', 'Oi')).toBe('https://wa.me/5545984157928?text=Oi')
  })

  test('keeps numbers that already carry a country code', () => {
    expect(waLink('+55 45 98415-7928', 'Oi')).toBe('https://wa.me/5545984157928?text=Oi')
  })

  test('drops the trunk zero people type before the area code', () => {
    expect(waLink('045 98415-7928', 'Oi')).toBe('https://wa.me/5545984157928?text=Oi')
  })

  test('encodes the message and refuses an empty phone', () => {
    expect(waLink('45984157928', 'Olá, tudo bem? R$ 50 & obrigado')).toBe(
      'https://wa.me/5545984157928?text=Ol%C3%A1%2C%20tudo%20bem%3F%20R%24%2050%20%26%20obrigado',
    )
    expect(waLink('', 'Oi')).toBeNull()
    expect(waLink(undefined, 'Oi')).toBeNull()
  })
})

describe('finding the patient behind an appointment', () => {
  const helenaSilva = patient({ _id: 'p1', name: 'Helena Silva' })
  const helenaCosta = patient({ _id: 'p2', name: 'Helena Costa' })
  const theo = patient({ _id: 'p3', name: 'Theo Martins' })
  const patients = [helenaSilva, helenaCosta, theo]

  test('matches the full name, ignoring case and spaces', () => {
    expect(findPatientByName(patients, '  theo martins ')).toBe(theo)
  })

  test('matches the short agenda name when only one patient fits', () => {
    expect(findPatientByName(patients, 'Helena S.')).toBe(helenaSilva)
    expect(findPatientByName(patients, 'Theo')).toBe(theo)
  })

  test('refuses to guess between two patients, so a message never goes to the wrong family', () => {
    expect(findPatientByName(patients, 'Helena')).toBeUndefined()
    expect(findPatientByName([helenaSilva, patient({ _id: 'p4', name: 'Helena Silva' })], 'Helena Silva')).toBeUndefined()
  })

  test('prefers the stored patient id over the name', () => {
    expect(findPatientForEvent(patients, { patientId: 'p2', child: 'Helena S.' })).toBe(helenaCosta)
    expect(findPatientForEvent(patients, { child: 'Helena S.' })).toBe(helenaSilva)
  })
})

describe('contact details and messages', () => {
  test('a child is contacted through the responsible adult', () => {
    const ana = patient({ phone: '45911112222', respPhone: '45933334444' })
    expect(contactPhone(ana)).toBe('45933334444')
    expect(contactName(ana)).toBe('Carla Souza')
    expect(msgRetorno(ana)).toContain('Oi, Carla Souza!')
    expect(msgRetorno(ana)).toContain('retorno de Ana')
  })

  test('an adult is contacted directly', () => {
    const bia = patient({ name: 'Beatriz Lima', perfil: 'adulto', resp: '—', phone: '45977772222' })
    expect(contactPhone(bia)).toBe('45977772222')
    expect(contactName(bia)).toBe('Beatriz Lima')
    expect(msgRetorno(bia)).toContain('seu retorno')
  })

  test('the confirmation names the time and falls back to "consulta"', () => {
    const msg = msgConfirmacao('Ana S.', patient(), 'amanhã', '14:30', '', true)
    expect(msg).toContain('confirmar a consulta de Ana')
    expect(msg).toContain('amanhã às 14:30 (consulta)')
  })
})
