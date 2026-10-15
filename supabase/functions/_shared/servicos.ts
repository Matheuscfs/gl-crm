// Serviços externos das Edge Functions: banco (chave de serviço), WhatsApp Cloud API e Asaas.
// Roda no Deno do Supabase. Os segredos ficam em Project Settings → Edge Functions → Secrets.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

export const env = (k: string, padrao = '') => Deno.env.get(k) ?? padrao

/** Cliente com a chave de serviço (ignora a RLS): só dentro das funções, nunca no app. */
export const banco = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

export const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })

/* ---------- WhatsApp Cloud API (Meta) ---------- */
const GRAPH = 'https://graph.facebook.com/v21.0'

export interface ResultadoEnvio { ok: boolean; id?: string; erro?: string }

/** Envia uma mensagem de MODELO aprovado (fora da janela de 24 h só modelos são permitidos). */
export async function enviarModelo(telefone: string, modelo: string, parametros: string[], idioma = 'pt_BR'): Promise<ResultadoEnvio> {
  const token = env('WHATSAPP_TOKEN'), phoneId = env('WHATSAPP_PHONE_ID')
  if (!token || !phoneId) return { ok: false, erro: 'WHATSAPP_TOKEN/WHATSAPP_PHONE_ID não configurados' }
  // parâmetros de modelo não aceitam quebra de linha nem tabulação
  const limpo = (t: string) => t.replace(/[\n\t]+/g, ' ').replace(/\s{4,}/g, '   ').slice(0, 1000)
  const r = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: telefone, type: 'template',
      template: { name: modelo, language: { code: idioma }, components: [{ type: 'body', parameters: parametros.map((t) => ({ type: 'text', text: limpo(t) })) }] },
    }),
  })
  const corpo = await r.json().catch(() => ({}))
  if (!r.ok) return { ok: false, erro: corpo?.error?.message ?? `HTTP ${r.status}` }
  return { ok: true, id: corpo?.messages?.[0]?.id }
}

/* ---------- Asaas (PIX, boleto e cartão com baixa automática) ---------- */
export async function asaas<T = Record<string, unknown>>(caminho: string, init: RequestInit = {}): Promise<{ ok: boolean; dados: T; erro?: string }> {
  const chave = env('ASAAS_API_KEY')
  if (!chave) return { ok: false, dados: {} as T, erro: 'ASAAS_API_KEY não configurada' }
  const base = env('ASAAS_BASE', 'https://api.asaas.com/v3')
  const r = await fetch(`${base}${caminho}`, { ...init, headers: { access_token: chave, 'Content-Type': 'application/json', 'User-Agent': 'gl-crm', ...(init.headers ?? {}) } })
  const dados = await r.json().catch(() => ({}))
  if (!r.ok) return { ok: false, dados, erro: dados?.errors?.[0]?.description ?? `HTTP ${r.status}` }
  return { ok: true, dados }
}
