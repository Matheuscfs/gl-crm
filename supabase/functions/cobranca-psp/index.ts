// Edge Function `cobranca-psp` — gera a cobrança de uma parcela no Asaas (PIX, boleto ou cartão,
// à escolha de quem paga) e devolve o link. Chamada pelo app (Financeiro) com o login da equipe.
// Deploy: supabase functions deploy cobranca-psp   (com verificação de JWT: só usuário logado)
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { isoDe, agoraBRT } from '../_shared/regras.ts'
import { banco, env, json, asaas } from '../_shared/servicos.ts'

interface Cliente { id: string }
interface Pagamento { id: string; invoiceUrl: string; status: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({})
  // confere o usuário logado (o gateway já validou o JWT; aqui só garantimos que existe)
  const auth = req.headers.get('Authorization') ?? ''
  const usuario = await createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } } }).auth.getUser()
  if (usuario.error || !usuario.data.user) return json({ erro: 'faça login no CRM' }, 401)

  const { installment_id } = await req.json().catch(() => ({}))
  if (!installment_id) return json({ erro: 'informe installment_id' }, 400)
  const db = banco()
  const { data: parc, error } = await db.from('installments').select('*').eq('id', installment_id).maybeSingle()
  if (error || !parc) return json({ erro: 'parcela não encontrada' }, 404)
  if (parc.status === 'pago') return json({ erro: 'parcela já paga' }, 409)
  if (parc.cobranca_id && parc.cobranca_link) return json({ link: parc.cobranca_link, id: parc.cobranca_id, reaproveitada: true })

  const { data: pac } = parc.patient_id ? await db.from('patients').select('*').eq('id', parc.patient_id).maybeSingle() : { data: null }
  const crianca = (pac?.perfil ?? 'pediatrico') === 'pediatrico' && pac?.resp_cpf
  const nome = (crianca ? (pac?.resp ?? '').split('·')[0].trim() : pac?.name) || parc.resp || 'Paciente'
  const cpf = String((crianca ? pac?.resp_cpf : pac?.cpf) ?? '').replace(/\D/g, '')
  const fone = String((crianca ? pac?.resp_phone : pac?.phone) ?? '').replace(/\D/g, '')
  if (cpf.length !== 11) return json({ erro: 'CPF do pagador ausente no cadastro (o Asaas exige CPF)' }, 422)

  // cliente: reaproveita pelo CPF
  const busca = await asaas<{ data: Cliente[] }>(`/customers?cpfCnpj=${cpf}`)
  if (!busca.ok) return json({ erro: busca.erro }, 502)
  let cliente = busca.dados.data?.[0]
  if (!cliente) {
    const novo = await asaas<Cliente>('/customers', { method: 'POST', body: JSON.stringify({ name: nome, cpfCnpj: cpf, mobilePhone: fone || undefined, notificationDisabled: true }) })
    if (!novo.ok) return json({ erro: novo.erro }, 502)
    cliente = novo.dados
  }

  const valor = Number(String(parc.val).replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.'))
  const hoje = agoraBRT().iso
  const venc = isoDe(parc.venc)
  const pg = await asaas<Pagamento>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: cliente.id, billingType: 'UNDEFINED', value: valor, dueDate: venc && venc >= hoje ? venc : hoje,
      description: `${parc.ref ?? 'Tratamento odontológico'} — ${env('NOME_DENTISTA', 'Dra. Gabriela Lorenzi')}`,
      externalReference: parc.id,
    }),
  })
  if (!pg.ok) return json({ erro: pg.erro }, 502)
  await db.from('installments').update({ cobranca_id: pg.dados.id, cobranca_link: pg.dados.invoiceUrl, cobranca_status: pg.dados.status }).eq('id', parc.id)
  return json({ link: pg.dados.invoiceUrl, id: pg.dados.id })
})
