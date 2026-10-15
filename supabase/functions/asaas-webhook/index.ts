// Edge Function `asaas-webhook` — o Asaas avisa quando a cobrança é paga: a parcela vira "pago"
// com a data do pagamento e o recibo é gerado sozinho (aparece no Financeiro e no Carnê-Leão).
// Deploy: supabase functions deploy asaas-webhook --no-verify-jwt   (autenticado pelo token do Asaas)
import { isoDe } from '../_shared/regras.ts'
import { banco, env, json } from '../_shared/servicos.ts'

const PAGO = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED_IN_CASH'])

Deno.serve(async (req) => {
  if (!env('ASAAS_WEBHOOK_TOKEN') || req.headers.get('asaas-access-token') !== env('ASAAS_WEBHOOK_TOKEN')) return json({ erro: 'não autorizado' }, 401)
  const { event, payment } = await req.json().catch(() => ({}))
  if (!payment?.externalReference) return json({ ok: true, ignorado: true })
  const db = banco()
  const { data: parc } = await db.from('installments').select('*').eq('id', payment.externalReference).maybeSingle()
  if (!parc) return json({ ok: true, ignorado: 'parcela não encontrada' })

  if (!PAGO.has(event)) {
    await db.from('installments').update({ cobranca_status: payment.status ?? event }).eq('id', parc.id)
    return json({ ok: true })
  }
  const pagoEm = isoDe(payment.clientPaymentDate ?? payment.paymentDate ?? payment.confirmedDate) || new Date().toISOString().slice(0, 10)
  await db.from('installments').update({ status: 'pago', pago_em: pagoEm, cobranca_status: payment.status ?? 'RECEIVED' }).eq('id', parc.id)

  // recibo automático (uma vez por parcela)
  const { data: existe } = await db.from('receipts').select('id').eq('origin', 'parcela').eq('ref_id', parc.id).maybeSingle()
  if (!existe) {
    const { data: pac } = parc.patient_id ? await db.from('patients').select('*').eq('id', parc.patient_id).maybeSingle() : { data: null }
    const crianca = (pac?.perfil ?? 'pediatrico') === 'pediatrico' && pac?.resp_cpf
    await db.from('receipts').insert({
      patient_id: parc.patient_id, payer_name: (crianca ? (pac?.resp ?? '').split('·')[0].trim() : pac?.name) || parc.resp || 'Paciente',
      payer_cpf: (crianca ? pac?.resp_cpf : pac?.cpf) ?? null, description: parc.ref ?? 'serviços odontológicos',
      value: Number(payment.value ?? 0), issued_on: pagoEm, origin: 'parcela', ref_id: parc.id,
    })
  }
  return json({ ok: true })
})
