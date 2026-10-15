// Edge Function `whatsapp-webhook` — URL de callback do app da Meta (WhatsApp → Configuration → Webhook).
// GET: verificação (hub.verify_token). POST: status das mensagens e respostas dos pacientes.
// "1"/"Confirmar" confirma o agendamento na Agenda; "2"/"Remarcar" marca para a recepção ligar.
// Deploy: supabase functions deploy whatsapp-webhook --no-verify-jwt
import { interpretarResposta, assinaturaValida } from '../_shared/regras.ts'
import { banco, env, json } from '../_shared/servicos.ts'

const STATUS: Record<string, string> = { sent: 'enviada', delivered: 'entregue', read: 'lida', failed: 'falhou' }

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (req.method === 'GET') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env('WHATSAPP_VERIFY_TOKEN') && !!env('WHATSAPP_VERIFY_TOKEN')
    return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('proibido', { status: 403 })
  }
  const corpo = await req.text()
  if (!(await assinaturaValida(env('WHATSAPP_APP_SECRET'), corpo, req.headers.get('x-hub-signature-256')))) return json({ erro: 'assinatura inválida' }, 401)

  const db = banco()
  const payload = JSON.parse(corpo || '{}')
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {}

      // 1. status das mensagens enviadas (entregue, lida, falhou)
      for (const s of v.statuses ?? []) {
        const status = STATUS[s.status]
        if (!status) continue
        await db.from('mensagens').update({ status, ...(s.errors?.[0] ? { erro: s.errors[0].title ?? s.errors[0].message } : {}) })
          .eq('wa_message_id', s.id).neq('status', 'respondida')
      }

      // 2. respostas: botão do modelo ou texto
      for (const m of v.messages ?? []) {
        const texto: string = m.button?.text ?? m.button?.payload ?? m.interactive?.button_reply?.title ?? m.text?.body ?? ''
        const acao = interpretarResposta(texto)
        // a resposta "cita" a mensagem original (context.id); sem isso, a confirmação mais recente para o número
        let alvo = m.context?.id
          ? (await db.from('mensagens').select('id,appointment_id,tipo').eq('wa_message_id', m.context.id).maybeSingle()).data
          : null
        if (!alvo) {
          const tel = String(m.from ?? '')
          alvo = (await db.from('mensagens').select('id,appointment_id,tipo').eq('telefone', tel).eq('tipo', 'confirmacao')
            .gte('created_at', new Date(Date.now() - 3 * 86_400_000).toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle()).data
        }
        if (!alvo) continue
        await db.from('mensagens').update({ status: 'respondida', resposta: acao ?? texto.slice(0, 500) }).eq('id', alvo.id)
        if (alvo.tipo === 'confirmacao' && alvo.appointment_id && acao === 'confirmar') {
          await db.from('appointments').update({ status: 'confirmado', confirmado_em: new Date().toISOString() })
            .eq('id', alvo.appointment_id).eq('status', 'agendado')
        }
      }
    }
  }
  return json({ ok: true })
})
