import { useStore } from '../store'

/** Anamnese do paciente, vinda do store compartilhado (reativa). */
export function useAnamnese(patientId: string | null): Record<string, unknown> | null {
  const { anamnese } = useStore()
  return patientId ? anamnese[patientId] ?? null : null
}

/** Alertas médicos derivados da anamnese (para o cabeçalho da ficha). */
export function alertsFromAnamnese(d: Record<string, unknown> | null, perfil?: string): string[] {
  if (!d) return []
  const a: string[] = []
  if (d.alergia === true) a.push(`Alergia${d.alergia_d ? ` a ${d.alergia_d}` : ''}`)
  if (d.doenca === true) a.push(String(d.doenca_d || 'Doença/síndrome'))
  if (d.medicamentos === true) a.push(`Medicação: ${d.medicamentos_d || 'contínua'}`)
  if (perfil === 'estetico') {
    if (d.est_anteriores === true) a.push('Procedimento estético prévio')
  } else {
    const hab = Array.isArray(d.habitos) ? (d.habitos as string[]) : []
    if (hab.includes('Sucção de dedo')) a.push('Sucção digital')
    if (d.comportamento) a.push(`Comportamento: ${d.comportamento}`)
  }
  return a
}
