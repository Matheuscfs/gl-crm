import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** True when the Supabase env vars are configured. */
export const supabaseReady = Boolean(url && key)

if (!supabaseReady) {
  // Não quebra o app — permite rodar com o store mockado enquanto o banco não está configurado.
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY ausentes — usando dados mockados.')
}

export const supabase = supabaseReady ? createClient(url!, key!) : null
