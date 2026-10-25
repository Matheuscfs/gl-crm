// Edge Function `automacao` — chamada a cada 15 min pelo pg_cron (supabase/automacao/agendar_cron.sql).
// Decide o que enviar (regras.ts), grava cada mensagem em `mensagens` e envia pelo WhatsApp Cloud API.
// Deploy: supabase functions deploy automacao --no-verify-jwt   (a chamada é autenticada pelo CRON_SECRET)
import { planejarEnvios, agoraBRT, somaDias, CONFIG_PADRAO, type Config } from '../_shared/regras.ts'
import { pixPayload } from '../_shared/pix.ts'
import { banco, env, json, enviarModelo } from '../_shared/servicos.ts'

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== env('CRON_SECRET') || !env('CRON_SECRET')) return json({ erro: 'não autorizado' }, 401)
  const db = banco()
  const { iso: hoje } = agoraBRT()
  const simular = new URL(req.url).searchParams.get('simular') === '1'

  const [cfgR, clinicaR, pacR, agR, parcR, estR, msgR] = await Promise.all([
    db.from('automacao_config').select('*').eq('key', 'automacao').maybeSingle(),
    db.from('clinic_settings').select('*').maybeSingle(),
    db.from('patients').select('id,name,perfil,resp,phone,resp_phone,birthdate,next,last'),
    db.from('appointments').select('id,patient_id,child,date,start,status,proc,cobrado_em').gte('date', somaDias(hoje, -1)).lte('date', somaDias(hoje, 60)),
    db.from('installments').select('id,patient_id,resp,ref,venc,val,status,cobranca_link').neq('status', 'pago'),
    db.from('stock_items').select('item,qtd,min,validade,un'),
    db.from('mensagens').select('tipo,appointment_id,installment_id,patient_id,ref_dia').gte('ref_dia', somaDias(hoje, -400)).neq('status', 'falhou'),
  ])
  const erroCarga = [cfgR, clinicaR, pacR, agR, parcR, estR, msgR].find((r) => r.error)?.error
  if (erroCarga) return json({ erro: erroCarga.message }, 500)

  const cfg: Config = { ...CONFIG_PADRAO, ...(cfgR.data ?? {}) }
  const c = clinicaR.data ?? {}
  const cidade = (c.cidade as string) || ((c.address as string) ?? '').split('-')[0] || 'BRASIL'
  const envios = planejarEnvios(
    { pacientes: pacR.data ?? [], agendamentos: agR.data ?? [], parcelas: parcR.data ?? [], estoque: estR.data ?? [], jaEnviadas: msgR.data ?? [] },
    cfg,
    {
      dentista: env('NOME_DENTISTA', 'Dra. Gabriela Lorenzi'), nome: (c.name as string) ?? '', linkAvaliacao: env('LINK_AVALIACAO') || undefined,
      pix: c.pix_key ? (valor, txid) => pixPayload({ key: c.pix_key as string, name: (c.name as string) ?? 'Clinica', city: cidade, amount: valor, txid }) : undefined,
    },
  )
  if (simular) return json({ simulado: true, envios })

  const resumo = { planejadas: envios.length, enviadas: 0, falhas: 0, repetidas: 0 }
  for (const e of envios) {
    // registra antes de enviar: o índice único impede mandar duas vezes se o cron rodar em paralelo
    const { data: reg, error } = await db.from('mensagens').insert({
      tipo: e.tipo, template: e.template, corpo: e.corpo, telefone: e.telefone, ref_dia: e.ref_dia, status: 'pendente',
      patient_id: e.patient_id ?? null, appointment_id: e.appointment_id ?? null, installment_id: e.installment_id ?? null,
    }).select('id').single()
    if (error) { if (error.code === '23505') resumo.repetidas++; else console.error('mensagens', error.message); continue }
    const r = await enviarModelo(e.telefone, e.template, e.parametros)
    await db.from('mensagens').update(r.ok
      ? { status: 'enviada', wa_message_id: r.id, enviada_em: new Date().toISOString() }
      : { status: 'falhou', erro: r.erro }).eq('id', reg.id)
    if (r.ok) {
      resumo.enviadas++
      if (e.tipo === 'confirmacao' && e.appointment_id) await db.from('appointments').update({ lembrete_em: new Date().toISOString() }).eq('id', e.appointment_id)
      if (e.tipo === 'cobranca' && e.installment_id) await db.from('installments').update({ lembrete_em: new Date().toISOString() }).eq('id', e.installment_id)
    } else resumo.falhas++
  }
  return json(resumo)
})
