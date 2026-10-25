import type { Patient } from '../src/data.ts'

/** A patient with every required field filled in; override only what the test is about. */
export function patient(overrides: Partial<Patient> = {}): Patient {
  return {
    initials: 'AS',
    name: 'Ana Souza',
    age: '7 anos',
    resp: 'Carla Souza · mãe',
    last: '',
    next: '',
    tipo: 'Particular',
    status: 'tratamento',
    perfil: 'pediatrico',
    ...overrides,
  }
}
