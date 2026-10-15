/* Mock data layer mirroring the design prototype (CRM Odontopediátrico.dc.html). */
import { DEMO_DATA } from './lib/demo'
import { INVENTARIO, INVENTARIO_DATA } from './inventario'
import { parseISO, addDays, todayISO, brDate } from './lib/dates'

export type ApptStatus =
  | 'agendado'
  | 'confirmado'
  | 'em_atendimento'
  | 'concluido'
  | 'faltou'
  | 'desmarcado'

export const STATUS: Record<
  ApptStatus,
  { label: string; dot: string; bg: string; fg: string; border: string }
> = {
  agendado: { label: 'Agendado', dot: '#64748b', bg: 'var(--chip-bg)', fg: 'var(--slate)', border: '#d7dde3' },
  confirmado: { label: 'Confirmado', dot: 'var(--primary)', bg: 'var(--primary-bg)', fg: 'var(--primary-dark)', border: 'var(--primary-border)' },
  em_atendimento: { label: 'Em atendimento', dot: '#d97706', bg: 'var(--amber-bg)', fg: 'var(--amber-dark)', border: '#f1dbb6' },
  concluido: { label: 'Concluído', dot: '#16a34a', bg: 'var(--green-bg)', fg: 'var(--green-dark)', border: '#c4e6cf' },
  faltou: { label: 'Faltou', dot: '#dc2626', bg: 'var(--red-bg)', fg: 'var(--danger-text)', border: 'var(--red-border)' },
  desmarcado: { label: 'Desmarcado', dot: '#94a3b8', bg: 'var(--chip-bg)', fg: '#7d8a97', border: '#e0e5e9' },
}

/* ---------- Agenda ---------- */

export const AGENDA_START = 8
export const AGENDA_ROW = 64
export const timeLabels = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']

export type ApptKind = 'ped' | 'est' | 'adt'

export interface AgendaEvent {
  start: number
  dur: number
  child: string
  age: string
  proc: string
  status: ApptStatus
  kind?: ApptKind
  date?: string
  /** Paciente do cadastro (id do banco). Agendamentos antigos só têm o nome em `child`. */
  patientId?: string
  /** Procedimento da tabela de preços — a cobrança e a baixa usam este, não o texto. */
  procId?: string
  /** Quando a conclusão já cobrou e deu baixa no estoque (evita cobrar duas vezes). */
  cobradoEm?: string
  /** Evento correspondente no Google Agenda. */
  gcalId?: string
  /** Confirmado pelo paciente respondendo ao WhatsApp automático. */
  confirmadoEm?: string
}

const E = (start: number, dur: number, child: string, age: string, proc: string, status: ApptStatus, kind: ApptKind = 'ped'): AgendaEvent => ({
  start, dur, child, age, proc, status, kind,
})

export const weekEvents: AgendaEvent[][] = [
  [E(8, 1, 'Helena S.', '6a', 'Restauração', 'confirmado'), E(9.5, 1, 'Théo R.', '7a', 'Selante', 'agendado'), E(14, 1.5, 'Camila N.', '32a', 'Botox — testa/glabela', 'desmarcado', 'est')],
  [E(10, 1, 'Laura N.', '4a', '1ª consulta', 'confirmado'), E(15, 1, 'Rodrigo A.', '41a', 'Preenchimento labial', 'agendado', 'est')],
  [E(8, 1, 'Miguel A.', '6a', 'Profilaxia', 'concluido'), E(9, 1.5, 'Sofia M.', '8a', 'Manut. aparelho', 'em_atendimento'), E(11, 1, 'Bento C.', '3a', 'Restauração', 'agendado'), E(14, 1, 'Camila N.', '32a', 'Retoque botox', 'confirmado', 'est'), E(16, 1, 'Nina B.', '7a', 'Flúor', 'agendado')],
  [E(9, 1, 'Davi M.', '5a', 'Restauração', 'faltou'), E(13, 1.5, 'Isabela P.', '10a', 'Aparelho', 'confirmado')],
  [E(8.5, 1, 'Lorenzo A.', '4a', '1ª consulta', 'confirmado'), E(15, 1, 'Marina H.', '38a', 'Harmonização', 'agendado', 'est')],
  [E(9, 1, 'Gael P.', '3a', 'Retorno', 'confirmado')],
]

export const fmtHour = (h: number) =>
  `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h - Math.floor(h)) * 60)).padStart(2, '0')}`

/* ---------- Pacientes ---------- */

export type TreatStatus = 'tratamento' | 'manutencao' | 'concluido' | 'lead' | 'primeira'

export const TREAT_STATUS: Record<TreatStatus, { label: string; bg: string; fg: string }> = {
  tratamento: { label: 'Em tratamento', bg: 'var(--primary-bg)', fg: 'var(--primary-dark)' },
  manutencao: { label: 'Manutenção', bg: 'var(--chip-bg)', fg: 'var(--slate)' },
  concluido: { label: 'Concluído', bg: 'var(--green-bg)', fg: 'var(--green-dark)' },
  lead: { label: 'Novo lead', bg: 'var(--amber-bg)', fg: 'var(--amber-dark)' },
  primeira: { label: '1ª consulta', bg: 'var(--chip-bg)', fg: '#1d4ed8' },
}

export type Perfil = 'pediatrico' | 'estetico' | 'adulto'

export const PERFIL: Record<Perfil, { label: string; short: string; bg: string; fg: string }> = {
  pediatrico: { label: 'Pediátrico', short: 'Ped.', bg: 'var(--primary-bg)', fg: 'var(--primary-dark)' },
  estetico: { label: 'Estético', short: 'Est.', bg: 'var(--brand-pink-bg)', fg: 'var(--brand-pink)' },
  adulto: { label: 'Adulto', short: 'Adt.', bg: '#e6f6f1', fg: '#0f766e' },
}

/** Mapeia o perfil do paciente para o "kind" do evento da agenda. */
export const perfilToKind = (perfil?: Perfil): ApptKind => (perfil === 'estetico' ? 'est' : perfil === 'adulto' ? 'adt' : 'ped')

export interface Patient {
  /** Id do banco (uuid). Provisório "tmp…" até o insert voltar; "seed-…" nos dados de demonstração. */
  _id?: string
  initials: string
  name: string
  age: string
  resp: string
  last: string
  next: string
  tipo: 'Particular' | 'Convênio'
  status: TreatStatus
  perfil?: Perfil
  late?: boolean
  // cadastro completo (Fase 1)
  birthdate?: string
  sex?: string
  cpf?: string
  phone?: string
  respCpf?: string
  respPhone?: string
  prontuario?: string
  /** Como conheceu a clínica (canal de captação). */
  origem?: string
  /** Foto de perfil (URL pública no Storage). */
  photoUrl?: string
}

/** Canais de captação — usados no cadastro de pacientes, no funil de leads e nos relatórios. */
export const ORIGENS = ['Instagram', 'Indicação', 'Google', 'Facebook', 'WhatsApp', 'Convênio', 'Outro']

/**
 * Paciente de demonstração (da carga seed)? As abas da ficha (anamnese, tratamentos,
 * planos, financeiro, documentos, fotos) só mostram dados demo para esses pacientes —
 * cadastros novos começam completamente zerados.
 */
export const isSeedPatient = (p?: string | { _id?: string; name?: string } | null) => {
  // fora do modo demonstração ninguém é "de exemplo": um homônimo do seed não herda dados fictícios
  if (!DEMO_DATA || !p) return false
  if (typeof p !== 'string') return p._id ? p._id.startsWith('seed-') : !!p.name && patients.some((s) => s.name === p.name)
  return patients.some((s) => s.name === p)
}

/** Categorias e subcategorias pré-cadastradas dos lançamentos financeiros (receitas e despesas). */
export const FIN_CATEGORIAS: Record<'receita' | 'despesa', { cat: string; subs: string[] }[]> = {
  receita: [
    { cat: 'Atendimentos', subs: ['Consulta', 'Procedimento clínico', 'Ortodontia', 'Urgência'] },
    { cat: 'Estética', subs: ['Toxina botulínica', 'Preenchimento', 'Bioestimulador', 'Skincare'] },
    { cat: 'Convênio', subs: ['Repasse de convênio'] },
    { cat: 'Outras receitas', subs: ['Venda de produto', 'Reembolso', 'Outros'] },
  ],
  despesa: [
    { cat: 'Materiais', subs: ['Insumos clínicos', 'Descartáveis', 'Instrumental', 'Injetáveis (toxina/preenchedor)'] },
    { cat: 'Laboratório', subs: ['Prótese', 'Alinhadores', 'Radiologia'] },
    { cat: 'Pessoal', subs: ['Salários', 'Pró-labore', 'Encargos', 'Treinamento'] },
    { cat: 'Estrutura', subs: ['Aluguel', 'Condomínio', 'Energia', 'Água', 'Internet e telefone', 'Limpeza'] },
    { cat: 'Equipamentos', subs: ['Compra', 'Manutenção', 'Calibração'] },
    { cat: 'Impostos e taxas', subs: ['Simples Nacional', 'ISS', 'Anuidade CRO', 'Contabilidade'] },
    { cat: 'Marketing', subs: ['Anúncios', 'Social media', 'Material gráfico'] },
    { cat: 'Financeiras', subs: ['Taxa de cartão', 'Tarifa bancária', 'Juros'] },
    { cat: 'Outras despesas', subs: ['Outros'] },
  ],
}

/** Rótulo de idade (anos e meses) a partir de uma data ISO (YYYY-MM-DD). */
export function idadeLabel(birthISO?: string): string {
  if (!birthISO) return ''
  // parseISO lê a data no fuso local: new Date('aaaa-mm-dd') seria meia-noite UTC, o dia anterior no Brasil
  const b = parseISO(birthISO)
  if (Number.isNaN(b.getTime())) return ''
  const now = new Date()
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth())
  if (now.getDate() < b.getDate()) months--
  if (months < 0) return ''
  const y = Math.floor(months / 12)
  const m = months % 12
  return y >= 12 ? `${y}a` : `${y}a ${m}m`
}

export const patients: Patient[] = [
  { initials: 'SM', name: 'Sofia Ribeiro Martins', age: '8a 4m', resp: 'Ana Paula · mãe', last: '12/03/2026', next: '12/09/2026', tipo: 'Particular', status: 'tratamento', perfil: 'pediatrico' },
  { initials: 'MA', name: 'Miguel Andrade', age: '6a 1m', resp: 'Carla Andrade · mãe', last: '17/07/2026', next: '17/01/2027', tipo: 'Convênio', status: 'manutencao', perfil: 'pediatrico' },
  { initials: 'BC', name: 'Bento Correia', age: '3a 2m', resp: 'Rafael Correia · pai', last: '17/07/2026', next: '14/08/2026', tipo: 'Particular', status: 'primeira', perfil: 'pediatrico' },
  { initials: 'LN', name: 'Laura Nunes', age: '4a 0m', resp: 'Bianca Nunes · mãe', last: '—', next: 'a agendar', tipo: 'Particular', status: 'lead', perfil: 'pediatrico' },
  { initials: 'AF', name: 'Alice Ferreira', age: '5a 6m', resp: 'Juliana Ferreira · mãe', last: '14/01/2026', next: '14/07/2026', tipo: 'Convênio', status: 'tratamento', perfil: 'pediatrico' },
  { initials: 'CM', name: 'Camila Nogueira', age: '32a', resp: '—', last: '02/07/2026', next: '02/11/2026', tipo: 'Particular', status: 'manutencao', perfil: 'estetico' },
  { initials: 'RA', name: 'Rodrigo Alves', age: '41a', resp: '—', last: '28/06/2026', next: 'a agendar', tipo: 'Particular', status: 'concluido', perfil: 'estetico' },
  { initials: 'DM', name: 'Davi Moreira', age: '5a 9m', resp: 'Sandra Moreira · mãe', last: '20/12/2025', next: 'vencido há 22d', tipo: 'Particular', status: 'tratamento', perfil: 'pediatrico', late: true },
  { initials: 'IP', name: 'Isabela Pires', age: '10a 2m', resp: 'Marcos Pires · pai', last: '10/07/2026', next: '10/10/2026', tipo: 'Convênio', status: 'concluido', perfil: 'pediatrico' },
]

/* ---------- Ficha Sofia ---------- */

export interface PatientTab { slug: string; label: string }

export const pediatricTabs: PatientTab[] = [
  { slug: 'dados', label: 'Dados & Responsáveis' },
  { slug: 'anamnese', label: 'Anamnese' },
  { slug: 'odontograma', label: 'Odontograma' },
  { slug: 'historico', label: 'Tratamentos' },
  { slug: 'evolucao', label: 'Evolução' },
  { slug: 'planos', label: 'Planos & Orçamentos' },
  { slug: 'financeiro', label: 'Financeiro' },
  { slug: 'documentos', label: 'Documentos' },
]

export const esteticoTabs: PatientTab[] = [
  { slug: 'dados', label: 'Dados' },
  { slug: 'anamnese', label: 'Anamnese' },
  { slug: 'antesdepois', label: 'Antes / Depois' },
  { slug: 'mapa', label: 'Mapa facial' },
  { slug: 'odontograma', label: 'Odontograma' },
  { slug: 'historico', label: 'Tratamentos' },
  { slug: 'evolucao', label: 'Evolução' },
  { slug: 'planos', label: 'Planos & Orçamentos' },
  { slug: 'financeiro', label: 'Financeiro' },
  { slug: 'documentos', label: 'Documentos' },
]

export const adultoTabs: PatientTab[] = [
  { slug: 'dados', label: 'Dados' },
  { slug: 'anamnese', label: 'Anamnese' },
  { slug: 'odontograma', label: 'Odontograma' },
  { slug: 'historico', label: 'Tratamentos' },
  { slug: 'evolucao', label: 'Evolução' },
  { slug: 'planos', label: 'Planos & Orçamentos' },
  { slug: 'financeiro', label: 'Financeiro' },
  { slug: 'documentos', label: 'Documentos' },
]

export const tabsFor = (perfil?: Perfil) => (perfil === 'estetico' ? esteticoTabs : perfil === 'adulto' ? adultoTabs : pediatricTabs)

/* ---------- Odontograma ---------- */

export type ToothState = 'higido' | 'cariado' | 'restaurado' | 'selante' | 'ausente' | 'erupcao' | 'extraido'

/** Cores do odontograma pela convenção clínica: vermelho = a tratar (cárie), azul = já tratado (restauração, extração feita). */
export const TOOTH: Record<
  ToothState,
  { label: string; fill: string; stroke: string; marker: string; bg: string; border: string; fg: string; glyph: string; dashed: boolean }
> = {
  higido:     { label: 'Hígido',      fill: '#ffffff', stroke: 'var(--border-strong)', marker: '#c9d2e2', bg: '#fff',     border: 'var(--border-strong)', fg: 'var(--slate)', glyph: '',  dashed: false },
  cariado:    { label: 'Cárie',       fill: 'rgba(217, 58, 63, 0.14)', stroke: '#d93a3f', marker: '#d93a3f', bg: 'var(--red-bg)', border: '#d93a3f', fg: 'var(--danger-text)', glyph: '',  dashed: false },
  restaurado: { label: 'Restaurado',  fill: 'rgba(59, 130, 246, 0.14)', stroke: '#3b82f6', marker: '#3b82f6', bg: 'var(--blue-bg)', border: '#3b82f6', fg: 'var(--blue-text)', glyph: '',  dashed: false },
  selante:    { label: 'Selante',     fill: '#d8f4f1', stroke: '#3fc7bf', marker: '#3fc7bf', bg: '#e3f7f5', border: '#3fc7bf', fg: '#1f938c', glyph: '•', dashed: false },
  ausente:    { label: 'Ausente',     fill: 'var(--chip-bg)', stroke: 'var(--border-strong)', marker: 'var(--muted)', bg: 'var(--chip-bg)', border: 'var(--border-strong)', fg: 'var(--muted)', glyph: '–', dashed: true  },
  erupcao:    { label: 'Em erupção',  fill: 'var(--brand-pink-bg)', stroke: '#ef9ec4', marker: '#ef9ec4', bg: 'var(--brand-pink-bg)', border: '#ef9ec4', fg: '#d16aa0', glyph: '↑', dashed: true  },
  extraido:   { label: 'Extraído',    fill: 'var(--blue-bg)', stroke: '#3b82f6', marker: '#3b82f6', bg: 'var(--blue-bg)', border: '#3b82f6', fg: 'var(--blue-text)', glyph: '✕', dashed: false },
}

export interface ToothItem {
  num: number
  state: ToothState
}

const arch = (nums: number[], states: ToothState[]): ToothItem[] => nums.map((num, i) => ({ num, state: states[i] }))

export const arches = {
  upR: arch([16, 55, 54, 53, 12, 11], ['erupcao', 'higido', 'restaurado', 'higido', 'erupcao', 'higido']),
  upL: arch([21, 22, 63, 64, 65, 26], ['higido', 'erupcao', 'higido', 'cariado', 'selante', 'erupcao']),
  loR: arch([46, 85, 84, 83, 42, 41], ['higido', 'selante', 'higido', 'higido', 'ausente', 'higido']),
  loL: arch([31, 32, 73, 74, 75, 36], ['higido', 'erupcao', 'higido', 'restaurado', 'cariado', 'higido']),
}

/* ---------- Anamnese ---------- */

export type Tone = 'ok' | 'observar' | 'alerta'

export const habitos: { k: string; v: string; tone: Tone }[] = [
  { k: 'Chupeta', v: 'Sim — até os 3 anos', tone: 'observar' },
  { k: 'Sucção digital', v: 'Sim — hábito atual', tone: 'alerta' },
  { k: 'Bruxismo', v: 'Relato de ranger noturno', tone: 'observar' },
  { k: 'Respiração bucal', v: 'Não relatada', tone: 'ok' },
]

/* ---------- Histórico ---------- */

export const FRANKL: Record<number, { label: string; bg: string; fg: string }> = {
  1: { label: '1 · Negativo', bg: 'var(--red-bg)', fg: 'var(--danger-text)' },
  2: { label: '2 · Reticente', bg: 'var(--amber-bg)', fg: 'var(--amber-dark)' },
  3: { label: '3 · Positivo', bg: 'var(--green-bg)', fg: 'var(--green-dark)' },
  4: { label: '4 · Muito positivo', bg: 'var(--primary-bg)', fg: 'var(--primary-dark)' },
}

export const historico = [
  { date: '12/03/2026', proc: 'Profilaxia + aplicação de flúor', prof: 'Dra. Gabriela Lorenzi', note: 'Boa colaboração. Reforçada técnica de escovação com a mãe.', frankl: 3 },
  { date: '14/01/2026', proc: 'Restauração em resina (74 O)', prof: 'Dra. Gabriela Lorenzi', note: 'Anestesia tópica + infiltrativa. Chorou no início, cooperou em seguida.', frankl: 2 },
  { date: '08/01/2026', proc: 'RX panorâmico + reavaliação', prof: 'Dra. Gabriela Lorenzi', note: 'Acompanhar erupção de 12 e 22. Sem cáries novas.', frankl: 3 },
  { date: '20/09/2025', proc: 'Selante de fóssulas (16, 26)', prof: 'Dra. Gabriela Lorenzi', note: 'Excelente cooperação, sem intercorrências.', frankl: 4 },
  { date: '15/06/2025', proc: '1ª consulta — adaptação', prof: 'Dra. Gabriela Lorenzi', note: 'Primeira visita. Tell-show-do. Programado retorno em 6 meses.', frankl: 3 },
]

/* ---------- Plano de tratamento ---------- */

export const planoItens = [
  { dente: '64', face: 'O', proc: 'Restauração em resina composta', val: 'R$ 180,00' },
  { dente: '75', face: 'MO', proc: 'Restauração em resina composta', val: 'R$ 210,00' },
  { dente: '16', face: '—', proc: 'Selante de fóssulas e fissuras', val: 'R$ 90,00' },
  { dente: '26', face: '—', proc: 'Selante de fóssulas e fissuras', val: 'R$ 90,00' },
  { dente: '—', face: '—', proc: 'Aplicação de flúor (sessão)', val: 'R$ 70,00' },
]

export const planoEstetico = [
  { regiao: 'Testa', proc: 'Toxina botulínica', qtd: '10U', val: 'R$ 350,00' },
  { regiao: 'Glabela', proc: 'Toxina botulínica', qtd: '8U', val: 'R$ 280,00' },
  { regiao: 'Pés de galinha', proc: 'Toxina botulínica', qtd: '12U', val: 'R$ 420,00' },
  { regiao: 'Lábios', proc: 'Preenchimento (ác. hialurônico)', qtd: '1ml', val: 'R$ 900,00' },
]

/* ---------- Financeiro ---------- */

export type ParcelaStatus = 'pago' | 'aberto' | 'vencida'
export const PARCELA_STATUS: Record<ParcelaStatus, { label: string; bg: string; fg: string }> = {
  pago: { label: 'Pago', bg: 'var(--green-bg)', fg: 'var(--green-dark)' },
  aberto: { label: 'Em aberto', bg: 'var(--chip-bg)', fg: 'var(--slate)' },
  vencida: { label: 'Vencida', bg: 'var(--red-bg)', fg: 'var(--danger-text)' },
}

/** Vencimento a `dias` de hoje — a demonstração não envelhece com o calendário. */
const vencEm = (dias: number) => brDate(addDays(todayISO(), dias))

export const parcelas: { resp: string; ref: string; venc: string; val: string; status: ParcelaStatus }[] = [
  { resp: 'Ana Paula Martins', ref: 'Sofia · Plano #218 (1/3)', venc: vencEm(-6), val: 'R$ 200,00', status: 'pago' },
  { resp: 'Rafael Correia', ref: 'Bento · Restauração', venc: vencEm(4), val: 'R$ 180,00', status: 'aberto' },
  { resp: 'Sandra Moreira', ref: 'Davi · Plano #201 (2/4)', venc: vencEm(-16), val: 'R$ 150,00', status: 'aberto' },
  { resp: 'Juliana Ferreira', ref: 'Alice · Manutenção', venc: vencEm(12), val: 'R$ 120,00', status: 'aberto' },
  { resp: 'Diego Ramos', ref: 'Théo · Selante', venc: vencEm(-9), val: 'R$ 180,00', status: 'pago' },
  { resp: 'Marcos Pires', ref: 'Isabela · Plano #199 (4/4)', venc: vencEm(-24), val: 'R$ 300,00', status: 'aberto' },
  { resp: 'Ana Paula Martins', ref: 'Sofia · Plano #218 (2/3)', venc: vencEm(24), val: 'R$ 200,00', status: 'aberto' },
  { resp: 'Sandra Moreira', ref: 'Davi · Plano #201 (1/4)', venc: vencEm(-46), val: 'R$ 150,00', status: 'pago' },
  { resp: 'Marcos Pires', ref: 'Isabela · Plano #199 (3/4)', venc: vencEm(-54), val: 'R$ 300,00', status: 'pago' },
  { resp: 'Camila Nogueira', ref: 'Toxina botulínica', venc: vencEm(-78), val: 'R$ 1.200,00', status: 'pago' },
  { resp: 'Marcos Pires', ref: 'Isabela · Plano #199 (2/4)', venc: vencEm(-85), val: 'R$ 300,00', status: 'pago' },
  { resp: 'Rodrigo Alves', ref: 'Preenchimento labial', venc: vencEm(-112), val: 'R$ 1.500,00', status: 'pago' },
  { resp: 'Marcos Pires', ref: 'Isabela · Plano #199 (1/4)', venc: vencEm(-116), val: 'R$ 300,00', status: 'pago' },
]

/* ---------- CRM ---------- */

export const funil = [
  { stage: 'Contato', count: 8, cards: [{ name: 'Laura Nunes', resp: 'Bianca · mãe', info: 'Instagram · há 2d' }, { name: 'Enzo Lima', resp: 'Paula · mãe', info: 'Indicação · há 1d' }] },
  { stage: '1ª consulta agendada', count: 5, cards: [{ name: 'Cecília Alves', resp: 'Rita · mãe', info: '19/07 · 09:00' }] },
  { stage: 'Compareceu', count: 6, cards: [{ name: 'Bento Correia', resp: 'Rafael · pai', info: 'hoje' }] },
  { stage: 'Tratamento aprovado', count: 4, cards: [{ name: 'Alice Ferreira', resp: 'Juliana · mãe', info: 'Plano #218' }] },
  { stage: 'Em tratamento', count: 11, cards: [{ name: 'Sofia Martins', resp: 'Ana Paula · mãe', info: '2/3 sessões' }] },
  { stage: 'Concluído', count: 9, cards: [{ name: 'Isabela Pires', resp: 'Marcos · pai', info: '10/07' }] },
  { stage: 'Manutenção', count: 14, cards: [{ name: 'Théo Ramos', resp: 'Diego · pai', info: 'retorno em 6m' }] },
]

export interface ReguaRule { id: string; title: string; when: string; on: boolean }

export const reguaPediatrico: ReguaRule[] = [
  { id: 'ped_lembrete48', title: 'Lembrete 48h antes', when: '48h antes da consulta', on: true },
  { id: 'ped_lembrete24', title: 'Lembrete 24h antes', when: '24h antes da consulta', on: true },
  { id: 'ped_aniversario', title: 'Aniversário da criança', when: 'no dia · 09:00', on: true },
  { id: 'ped_retorno6m', title: 'Retorno de 6 meses', when: '6 meses após a visita', on: true },
]

export const reguaEstetico: ReguaRule[] = [
  { id: 'est_lembrete48', title: 'Lembrete de consulta', when: '24h antes da sessão', on: true },
  { id: 'est_retoque', title: 'Lembrete de retoque', when: '~4 meses após aplicação', on: true },
  { id: 'est_aniversario', title: 'Aniversário do paciente', when: 'no dia · 09:00', on: true },
  { id: 'est_reativacao', title: 'Reativação de inativos', when: '8 meses sem retorno', on: false },
]

// compat
export const reguaAdulto: ReguaRule[] = [
  { id: 'adt_lembrete48', title: 'Lembrete 48h antes', when: '48h antes da consulta', on: true },
  { id: 'adt_lembrete24', title: 'Lembrete 24h antes', when: '24h antes da consulta', on: true },
  { id: 'adt_aniversario', title: 'Aniversário do paciente', when: 'no dia · 09:00', on: true },
  { id: 'adt_retorno6m', title: 'Retorno / manutenção', when: '6 meses após a visita', on: true },
]

/* ---------- Configurações ---------- */

// durMin em minutos; val em reais (numéricos — a exibição é formatada por fmtDur/fmtMoney)
export const procedimentos = [
  { proc: '1ª consulta / avaliação', cat: 'Diagnóstico', durMin: 40, val: 150 },
  { proc: 'Profilaxia + flúor', cat: 'Prevenção', durMin: 30, val: 120 },
  { proc: 'Selante (por dente)', cat: 'Prevenção', durMin: 20, val: 90 },
  { proc: 'Restauração em resina', cat: 'Dentística', durMin: 40, val: 180 },
  { proc: 'Pulpotomia', cat: 'Endodontia', durMin: 50, val: 320 },
  { proc: 'Extração de decíduo', cat: 'Cirurgia', durMin: 30, val: 160 },
]

export const horarios = [
  { d: 'Segunda', h: '08:00 – 18:00' },
  { d: 'Terça', h: '08:00 – 18:00' },
  { d: 'Quarta', h: '08:00 – 18:00' },
  { d: 'Quinta', h: '08:00 – 18:00' },
  { d: 'Sexta', h: '08:00 – 17:00' },
  { d: 'Sábado', h: '08:00 – 12:00' },
  { d: 'Domingo', h: 'Fechado', off: true },
]

/* ---------- Estoque ---------- */

export type EstoqueStatus = 'ok' | 'baixo' | 'critico'
export const ESTOQUE_STATUS: Record<EstoqueStatus, { label: string; bg: string; fg: string; qty: string }> = {
  ok: { label: 'Em dia', bg: 'var(--green-bg)', fg: 'var(--green-dark)', qty: 'var(--ink)' },
  baixo: { label: 'Abaixo do mínimo', bg: 'var(--amber-bg)', fg: 'var(--amber-dark)', qty: 'var(--amber-dark)' },
  critico: { label: 'Crítico', bg: 'var(--red-bg)', fg: 'var(--danger-text)', qty: 'var(--danger-text)' },
}

/** `q < min` → repor; metade (ou menos) do mínimo → crítico. Mínimo 0 = não definido. */
export function statusDe(qtd: number | string, min: number | string): EstoqueStatus {
  const q = Number(qtd)
  const m = Number(min)
  if (Number.isNaN(q) || Number.isNaN(m)) return 'ok'
  if (m <= 0) return q <= 0 ? 'critico' : 'ok'
  if (q <= 0 || q * 2 < m) return 'critico'
  return q < m ? 'baixo' : 'ok'
}

export interface EstoqueRow {
  item: string
  cat: string
  qtd: string
  min: string
  un: string
  valor: string
  marca: string
  validade: string
  lote: string
  fornecedor: string
  status: EstoqueStatus
  ent: string
  /** Mínimo ainda é a sugestão automática (não confirmado pela clínica). */
  minAuto: boolean
}

/** Estoque inicial = inventário real do consultório, com mínimo sugerido a confirmar. */
export const estoque: EstoqueRow[] = INVENTARIO.map((i) => ({
  item: i.item,
  cat: i.cat,
  qtd: String(i.qtd),
  min: String(i.min),
  un: i.un,
  valor: '',
  marca: '',
  validade: '',
  lote: '',
  fornecedor: '',
  status: statusDe(i.qtd, i.min),
  ent: INVENTARIO_DATA,
  minAuto: true,
}))

export const movimentacoes: { tipo: string; desc: string; when: string; delta: string; kind: 'entrada' | 'saida' }[] = [
  { tipo: 'Saída', desc: 'Restauração (74) · Bento Correia', when: 'hoje 10:40', delta: '−6 itens', kind: 'saida' },
  { tipo: 'Saída', desc: 'Profilaxia + flúor · Miguel Andrade', when: 'hoje 08:30', delta: '−4 itens', kind: 'saida' },
  { tipo: 'Entrada', desc: 'Compra — Dental Cremer · NF 8823', when: 'ontem 16:10', delta: '+120 itens', kind: 'entrada' },
  { tipo: 'Saída', desc: 'Selante (16, 26) · Théo Ramos', when: '15/07 15:20', delta: '−3 itens', kind: 'saida' },
]
