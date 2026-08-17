import { supabase } from './supabase'

export const PHOTO_BUCKET = 'patient-photos'

/**
 * O bucket é privado: o que fica gravado no banco é o CAMINHO do objeto, e a
 * exibição pede uma URL assinada (ver `lib/photos.ts`). Guardar URL pública
 * deixaria a foto acessível a quem não está autenticado.
 */

/** Envia uma foto ao Storage e devolve o caminho do objeto (ou null se indisponível). */
export async function uploadPatientPhoto(
  patientId: string,
  angle: string,
  slot: 'before' | 'after',
  file: File,
): Promise<string | null> {
  if (!supabase) return null
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const safeAngle = angle.normalize('NFD').replace(/[^\w]+/g, '_')
  const path = `${patientId}/${safeAngle}-${slot}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { upsert: true, cacheControl: '3600' })
  if (error) {
    console.error('[supabase] upload', error.message)
    return null
  }
  return path
}

/** Envia a foto de perfil do paciente e devolve o caminho do objeto (ou null se indisponível). */
export async function uploadAvatar(patientId: string, file: File): Promise<string | null> {
  if (!supabase) return null
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${patientId}/avatar-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { upsert: true, cacheControl: '3600' })
  if (error) {
    console.error('[supabase] upload avatar', error.message)
    return null
  }
  return path
}
