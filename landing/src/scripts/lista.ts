/**
 * Grava na tabela lista_espera (supabase/lista_espera.sql) pela API REST do Supabase.
 * A chave publicável só consegue inserir: ler a lista é pelo painel do Supabase.
 */
const URL_SUPABASE = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined
const CHAVE = import.meta.env.PUBLIC_SUPABASE_KEY as string | undefined

export type Resultado = 'ok' | 'ja' | 'teste' | 'erro'

export async function entrarNaLista(d: { nome: string; email: string; whatsapp: string; tamanho: string }): Promise<Resultado> {
  if (!URL_SUPABASE || !CHAVE) {
    if (import.meta.env.DEV) {
      console.warn('[lista] PUBLIC_SUPABASE_URL/PUBLIC_SUPABASE_KEY vazios: nada foi gravado.', d)
      return 'teste'
    }
    console.error('[lista] sem PUBLIC_SUPABASE_URL/PUBLIC_SUPABASE_KEY no build: a inscrição não foi gravada.')
    return 'erro'
  }
  const q = new URLSearchParams(location.search)
  let origem = q.get('utm_source')
  if (!origem && document.referrer) {
    try { origem = new URL(document.referrer).hostname } catch {}
  }
  try {
    const r = await fetch(`${URL_SUPABASE}/rest/v1/lista_espera`, {
      method: 'POST',
      headers: { apikey: CHAVE, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        nome: d.nome.slice(0, 120),
        email: d.email.toLowerCase().slice(0, 200),
        whatsapp: d.whatsapp ? d.whatsapp.slice(0, 30) : null,
        tamanho: d.tamanho,
        origem: origem ? origem.slice(0, 120) : null,
      }),
    })
    if (r.ok) return 'ok'
    if (r.status === 409) return 'ja' // e-mail repetido (índice único)
    console.error('[lista]', r.status, await r.text())
    return 'erro'
  } catch (e) {
    console.error('[lista]', e)
    return 'erro'
  }
}
