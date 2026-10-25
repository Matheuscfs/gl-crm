import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import {
  planejarEnvios, interpretarResposta, assinaturaValida, telefoneE164, agoraBRT, somaMeses, CONFIG_PADRAO,
  type Paciente, type Agendamento, type Parcela,
} from '../supabase/functions/_shared/regras.ts'

// 15/10/2026 10:00 em Brasília = 13:00 UTC
const AGORA = new Date(Date.UTC(2026, 9, 15, 13, 0))
const cfg = { ...CONFIG_PADRAO, whatsapp_ativo: true, telefone_alertas: '(45) 99999-0000' }
const clinica = { dentista: 'Dra. Gabriela Lorenzi', nome: 'Consultório', pix: (v: number) => `PIX-${v.toFixed(2)}` }

const ana: Paciente = { id: 'p1', name: 'Ana Souza', perfil: 'pediatrico', resp: 'Carla Souza · mãe', resp_phone: '(45) 98888-1111', birthdate: '2019-10-15', next: '18/10/2026' }
const bia: Paciente = { id: 'p2', name: 'Beatriz Lima', perfil: 'estetico', phone: '45977772222', last: '01/05/2026' }
const semTel: Paciente = { id: 'p3', name: 'Caio', perfil: 'adulto' }

const base = () => ({ pacientes: [ana, bia, semTel], agendamentos: [] as Agendamento[], parcelas: [] as Parcela[], estoque: [], jaEnviadas: [] })

test('horário de Brasília e datas', () => {
  assert.deepEqual(agoraBRT(AGORA), { iso: '2026-10-15', hora: 10, mes: 10, dia: 15 })
  assert.equal(somaMeses('2026-01-31', 1), '2026-02-28')
  assert.equal(telefoneE164('(45) 98888-1111'), '5545988881111')
  assert.equal(telefoneE164('123'), '')
})

test('não envia nada com o WhatsApp desligado ou fora do horário', () => {
  assert.equal(planejarEnvios(base(), { ...cfg, whatsapp_ativo: false }, clinica, AGORA).length, 0)
  assert.equal(planejarEnvios(base(), cfg, clinica, new Date(Date.UTC(2026, 9, 15, 2, 0))).length, 0) // 23h
})

test('confirmação vai ao responsável da criança, dentro das 24 h, uma vez só', () => {
  const d = base()
  d.agendamentos = [
    { id: 'a1', patient_id: 'p1', child: 'Ana', date: '2026-10-16', start: 9, status: 'agendado' }, // 23 h depois
    { id: 'a2', patient_id: 'p1', child: 'Ana', date: '2026-10-17', start: 9, status: 'agendado' }, // 47 h: fora
    { id: 'a3', patient_id: 'p1', child: 'Ana', date: '2026-10-16', start: 9, status: 'confirmado' },
  ]
  const conf = planejarEnvios(d, cfg, clinica, AGORA).filter((e) => e.tipo === 'confirmacao')
  assert.equal(conf.length, 1)
  assert.equal(conf[0].appointment_id, 'a1')
  assert.equal(conf[0].telefone, '5545988881111')
  assert.match(conf[0].corpo, /Olá, Carla! Lembrando a consulta de Ana com a Dra\. Gabriela Lorenzi amanhã \(sexta, 16\/10\) às 09:00/)
  d.jaEnviadas = [{ tipo: 'confirmacao', appointment_id: 'a1', ref_dia: '2026-10-15' }] as never
  assert.equal(planejarEnvios(d, cfg, clinica, AGORA).filter((e) => e.tipo === 'confirmacao').length, 0)
})

test('cobrança segue a régua D-3, D0, D+3 com PIX', () => {
  const d = base()
  d.parcelas = [
    { id: 'i1', patient_id: 'p1', ref: 'Plano #1', venc: '18/10/2026', val: 'R$ 150,00', status: 'aberto' }, // D-3
    { id: 'i2', patient_id: 'p1', ref: 'Plano #1', venc: '15/10/2026', val: '150', status: 'aberto' }, // D0
    { id: 'i3', patient_id: 'p1', ref: 'Plano #1', venc: '12/10/2026', val: '150', status: 'aberto' }, // D+3
    { id: 'i4', patient_id: 'p1', ref: 'Plano #1', venc: '14/10/2026', val: '150', status: 'aberto' }, // D+1: fora
    { id: 'i5', patient_id: 'p1', ref: 'Plano #1', venc: '15/10/2026', val: '150', status: 'pago' },
  ]
  const cob = planejarEnvios(d, cfg, clinica, AGORA).filter((e) => e.tipo === 'cobranca')
  assert.deepEqual(cob.map((e) => e.installment_id).sort(), ['i1', 'i2', 'i3'])
  assert.match(cob.find((e) => e.installment_id === 'i1')!.corpo, /R\$ 150,00 \(Plano #1\) vence em 18\/10\. Para pagar: PIX-150\.00/)
  assert.match(cob.find((e) => e.installment_id === 'i3')!.corpo, /venceu em 12\/10/)
})

test('aniversário, retorno e retoque; quem já tem horário não recebe lembrete', () => {
  const tipos = planejarEnvios(base(), cfg, clinica, AGORA).map((e) => `${e.tipo}:${e.patient_id}`).sort()
  assert.deepEqual(tipos, ['aniversario:p1', 'lembrete_retorno:p1', 'retoque:p2'])
  const d = base()
  d.agendamentos = [{ id: 'a9', patient_id: 'p1', child: 'Ana', date: '2026-10-20', start: 9, status: 'confirmado' }]
  assert.ok(!planejarEnvios(d, cfg, clinica, AGORA).some((e) => e.tipo === 'lembrete_retorno'))
})

test('alerta de estoque para a clínica, uma vez por dia', () => {
  const d = { ...base(), estoque: [{ item: 'Resina A2', qtd: 1, min: 3 }, { item: 'Anestésico', qtd: 10, min: 2, validade: '2026-10-30' }] }
  const est = planejarEnvios(d, cfg, clinica, AGORA).filter((e) => e.tipo === 'estoque')
  assert.equal(est.length, 1)
  assert.match(est[0].corpo, /comprar: Resina A2 \(1\/3\) · validade: Anestésico 30\/10/)
  assert.equal(est[0].telefone, '5545999990000')
})

test('respostas: confirmar e remarcar', () => {
  for (const t of ['1', 'Sim', 'SIM!', 'Confirmar', 'confirmo', 'ok']) assert.equal(interpretarResposta(t), 'confirmar', t)
  for (const t of ['2', 'não', 'Remarcar', 'preciso remarcar'.split(' ')[1], 'cancelar']) assert.equal(interpretarResposta(t), 'remarcar', t)
  assert.equal(interpretarResposta('qual o endereço?'), null)
})

test('assinatura do webhook da Meta', async () => {
  const corpo = '{"entry":[]}'
  const sig = 'sha256=' + createHmac('sha256', 'segredo').update(corpo).digest('hex')
  assert.equal(await assinaturaValida('segredo', corpo, sig), true)
  assert.equal(await assinaturaValida('outro', corpo, sig), false)
  assert.equal(await assinaturaValida('segredo', corpo, null), false)
})
