import { supabase } from './supabase'

/**
 * Anexos do prontuário (radiografias, fotos intraorais, exames, termos assinados) no bucket
 * PRIVADO `patient-files` (migração 0026). Nada fica público: para abrir, o app pede um link
 * assinado que vale 1 hora.
 */
export const FILES_BUCKET = 'patient-files'

const limpar = (nome: string) =>
  nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80)

/** Envia o arquivo; devolve o caminho no bucket ou a mensagem de erro. */
export async function enviarArquivo(patientId: string, file: File): Promise<{ path: string } | { erro: string }> {
  if (!supabase) return { erro: 'Sem banco configurado.' }
  if (file.size > 25 * 1024 * 1024) return { erro: 'Arquivo maior que 25 MB.' }
  const path = `${patientId}/${Date.now()}-${limpar(file.name)}`
  const { error } = await supabase.storage.from(FILES_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (error) {
    const semBucket = /bucket.*not.*found|not found/i.test(error.message)
    return { erro: semBucket ? 'O armazenamento de anexos ainda não existe no banco — aplique a migração 0026.' : error.message }
  }
  return { path }
}

/** Link temporário (1 h) para abrir ou baixar o anexo. */
export async function linkArquivo(path: string, baixar?: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(path, 60 * 60, baixar ? { download: baixar } : undefined)
  if (error) { console.error('[supabase] link anexo', error.message); return null }
  return data.signedUrl
}

export async function removerArquivo(path: string): Promise<boolean> {
  if (!supabase) return true
  const { error } = await supabase.storage.from(FILES_BUCKET).remove([path])
  if (error) console.error('[supabase] remover anexo', error.message)
  return !error
}
