import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { PHOTO_BUCKET } from './storage'

/**
 * Fotos de paciente ficam em bucket PRIVADO: nada é servido por URL pública.
 * Cada exibição pede uma URL assinada de curta duração, que só o Storage emite
 * para quem está autenticado.
 *
 * O banco pode guardar o caminho do objeto (formato novo) ou uma URL pública
 * antiga; os dois são aceitos aqui para não quebrar o que já foi cadastrado.
 */

const TTL = 60 * 60 // 1 h de validade
const RENEW = 5 * 60 * 1000 // renova quando faltarem 5 min
const cache = new Map<string, { url: string; exp: number }>()

/** Caminho do objeto no bucket. null quando não é uma foto do Storage. */
export function storagePath(ref?: string): string | null {
  if (!ref) return null
  if (ref.startsWith('blob:') || ref.startsWith('data:')) return null // pré-visualização local
  const publico = ref.indexOf(`/object/public/${PHOTO_BUCKET}/`)
  if (publico >= 0) return ref.slice(publico + `/object/public/${PHOTO_BUCKET}/`.length).split('?')[0]
  const assinado = ref.indexOf(`/object/sign/${PHOTO_BUCKET}/`)
  if (assinado >= 0) return ref.slice(assinado + `/object/sign/${PHOTO_BUCKET}/`.length).split('?')[0]
  if (ref.startsWith('http')) return null // URL de outro lugar (ex.: Drive)
  return ref.replace(/^\/+/, '')
}

/** URL assinada para exibir a foto. Devolve a própria referência quando não é do Storage. */
export async function signPhoto(ref?: string): Promise<string | undefined> {
  if (!ref) return undefined
  const path = storagePath(ref)
  if (!path || !supabase) return ref
  const hit = cache.get(path)
  if (hit && hit.exp - Date.now() > RENEW) return hit.url
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, TTL)
  if (error || !data?.signedUrl) {
    console.error('[supabase] signed url', error?.message)
    return undefined
  }
  cache.set(path, { url: data.signedUrl, exp: Date.now() + TTL * 1000 })
  return data.signedUrl
}

/** Resolve a foto para exibição; `undefined` enquanto assina ou se falhar. */
export function usePhotoSrc(ref?: string): string | undefined {
  const [src, setSrc] = useState<string | undefined>(() => {
    if (!ref) return undefined
    const path = storagePath(ref)
    if (!path) return ref // blob/data: já é exibível
    const hit = cache.get(path)
    return hit && hit.exp - Date.now() > RENEW ? hit.url : undefined
  })
  useEffect(() => {
    let cancelled = false
    if (!ref) { setSrc(undefined); return }
    signPhoto(ref).then((u) => { if (!cancelled) setSrc(u) })
    return () => { cancelled = true }
  }, [ref])
  return src
}
