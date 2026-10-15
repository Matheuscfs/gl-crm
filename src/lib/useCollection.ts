import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabase'
import { useStore } from '../store'
import { isSeedPatient } from '../data'
import { ehProvisorio, inserir, atualizar, apagar, resolverProvisorio } from './sync'

let seq = 5000
const tmp = () => `tmp${++seq}`

/**
 * Paciente da ficha aberta. A rota traz o id (links antigos com o nome ainda funcionam).
 * `patientId` é o uuid do banco — null na demonstração e enquanto o cadastro novo não sincronizou.
 */
export function usePatient() {
  const { id } = useParams()
  const { findPatient } = useStore()
  const patient = findPatient(id)
  return {
    patient,
    patientId: patient && !ehProvisorio(patient._id) ? patient._id : null,
    name: patient?.name ?? '',
    /** Paciente de demonstração (só com os dados fictícios ligados). */
    demo: isSeedPatient(patient),
  }
}

/** Uuid do paciente da ficha (null na demonstração). */
export function usePatientId(): string | null {
  return usePatient().patientId
}

/**
 * Coleção por paciente com estado local otimista + sincronização opcional com Supabase.
 * Se `patientId` for null ou o Supabase não estiver configurado, opera 100% local (mock).
 */
export function useCollection<T extends { id: string }>(
  table: string,
  patientId: string | null,
  mapRow: (r: Record<string, unknown>) => T,
  toRow: (item: Omit<T, 'id'>) => Record<string, unknown>,
  seed: T[],
  /** Mantém o seed quando o banco responde vazio — use quando o seed deriva do cadastro real (ex.: responsáveis). */
  keepSeedWhenEmpty = false,
) {
  const [rows, setRows] = useState<T[]>(seed)
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const live = Boolean(supabase && patientId)

  useEffect(() => {
    if (!supabase || !patientId) return
    let cancelled = false
    supabase
      .from(table)
      .select('*')
      .eq('patient_id', patientId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error(`[supabase] load ${table}`, error.message)
          return
        }
        if (data && (data.length > 0 || !keepSeedWhenEmpty)) setRows(data.map((r) => mapRow(r as Record<string, unknown>)))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, patientId])

  /**
   * Inclui na tela na hora e grava no banco. A promessa diz se o banco aceitou — a tela só
   * deve dizer "salvo" depois dela. Se o banco recusar, a linha some (e o aviso aparece).
   */
  const add = async (item: Omit<T, 'id'>): Promise<boolean> => {
    const id = tmp()
    setRows((prev) => [{ ...(item as object), id } as T, ...prev])
    if (!live || !patientId) return true
    const real = await inserir(table, { patient_id: patientId, ...toRow(item) })
    resolverProvisorio(id, real)
    setRows((prev) => (real ? prev.map((r) => (r.id === id ? { ...r, id: real } : r)) : prev.filter((r) => r.id !== id)))
    return !!real
  }

  /** Atualiza; se o banco recusar, volta ao que era. */
  const save = async (item: T): Promise<boolean> => {
    const antes = rowsRef.current.find((r) => r.id === item.id)
    setRows((prev) => prev.map((r) => (r.id === item.id ? item : r)))
    if (!live) return true
    const { id, ...rest } = item as T & Record<string, unknown>
    const ok = await atualizar(table, id, toRow(rest as Omit<T, 'id'>))
    if (!ok && antes) setRows((prev) => prev.map((r) => (r.id === item.id ? antes : r)))
    return ok
  }

  /** Exclui; se o banco recusar, a linha volta. */
  const remove = async (id: string): Promise<boolean> => {
    const antes = rowsRef.current.find((r) => r.id === id)
    setRows((prev) => prev.filter((r) => r.id !== id))
    if (!live) return true
    const ok = await apagar(table, id)
    if (!ok && antes) setRows((prev) => [antes, ...prev])
    return ok
  }

  return { rows, setRows, add, save, remove }
}
