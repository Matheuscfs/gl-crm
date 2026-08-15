import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabase'
import { useStore } from '../store'

let seq = 5000
const tmp = () => `tmp${++seq}`

/** Resolve o id (uuid) do paciente da ficha a partir do nome na URL. null em modo mock. */
export function usePatientId(): string | null {
  const { id } = useParams()
  const { patients } = useStore()
  const name = id ? decodeURIComponent(id) : ''
  const found = patients.find((p) => p.name === name) as (typeof patients)[number] & { _id?: string } | undefined
  return found?._id ?? null
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

  const add = (item: Omit<T, 'id'>) => {
    const id = tmp()
    setRows((prev) => [{ ...(item as object), id } as T, ...prev])
    if (live && supabase && patientId) {
      supabase
        .from(table)
        .insert({ patient_id: patientId, ...toRow(item) })
        .select('id')
        .single()
        .then(({ data, error }) => {
          if (error) return console.error(`[supabase] insert ${table}`, error.message)
          if (data) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, id: (data as { id: string }).id } : r)))
        })
    }
    return id
  }

  const save = (item: T) => {
    setRows((prev) => prev.map((r) => (r.id === item.id ? item : r)))
    if (live && supabase && !item.id.startsWith('tmp')) {
      const { id, ...rest } = item as T & Record<string, unknown>
      void id
      supabase
        .from(table)
        .update(toRow(rest as Omit<T, 'id'>))
        .eq('id', item.id)
        .then(({ error }) => { if (error) console.error(`[supabase] update ${table}`, error.message) })
    }
  }

  const remove = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
    if (live && supabase && !id.startsWith('tmp')) {
      supabase.from(table).delete().eq('id', id).then(({ error }) => { if (error) console.error(`[supabase] delete ${table}`, error.message) })
    }
  }

  return { rows, setRows, add, save, remove }
}
