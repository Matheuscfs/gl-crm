import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from './Modal'
import { Button } from './Button'
import { Icon, type IconName } from '../icons'
import { BRAND } from '../brand'

const KEY = 'gl-onboarding-v1'

/** Já concluiu (ou pulou) o guia de primeiros passos? */
export function onboardingDone(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return true }
}
const markDone = () => { try { localStorage.setItem(KEY, '1') } catch { /* ignore */ } }

interface Step { icon: IconName; title: string; desc: string; to?: string; cta?: string }

const STEPS: Step[] = [
  { icon: 'home', title: `Bem-vinda, ${BRAND.dentist}!`, desc: 'Este guia rápido deixa o consultório pronto em poucos minutos. Você pode refazê-lo quando quiser pelo botão Ajuda, no menu lateral.' },
  { icon: 'gear', title: 'Perfil da clínica e chave PIX', desc: 'Confira nome, CRO e endereço, e cadastre a chave PIX — ela alimenta a cobrança por WhatsApp e o PIX copia e cola do Financeiro.', to: '/configuracoes', cta: 'Abrir Configurações' },
  { icon: 'cal', title: 'Horários de atendimento', desc: 'Defina os horários de cada dia da semana — a Agenda passa a respeitar automaticamente os períodos de atendimento e os dias fechados.', to: '/configuracoes', cta: 'Definir horários' },
  { icon: 'clipboard', title: 'Procedimentos e preços', desc: 'Cadastre os procedimentos com valor, duração e ficha técnica de materiais. Eles alimentam a Agenda, os Planos & Orçamentos e a baixa automática do estoque.', to: '/ficha-procedimento', cta: 'Abrir procedimentos' },
  { icon: 'box', title: 'Estoque inicial', desc: 'Registre os materiais com quantidade mínima, validade e lote. O sistema avisa no sino quando algo está acabando ou perto de vencer.', to: '/estoque', cta: 'Abrir estoque' },
  { icon: 'users', title: 'Primeiro paciente', desc: 'Cadastre um paciente e explore a ficha completa: anamnese, odontograma, evolução, planos, financeiro e documentos.', to: '/pacientes', cta: 'Cadastrar paciente' },
  { icon: 'chat', title: 'Relacionamento (CRC)', desc: 'O CRC organiza sozinho retornos vencidos, faltas e aniversariantes em filas de contato, com WhatsApp em um clique. Bom trabalho! 🦷', to: '/crm', cta: 'Conhecer o CRC' },
]

/** Guia de primeiros passos em formato wizard — abre no primeiro acesso e pelo botão Ajuda. */
export function Onboarding({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [i, setI] = useState(0)
  const s = STEPS[i]
  const last = i === STEPS.length - 1
  const finish = () => { markDone(); setI(0); onClose() }
  const goTo = (to: string) => { markDone(); setI(0); onClose(); navigate(to) }

  return (
    <Modal open={open} onClose={finish} title="Primeiros passos" subtitle={`Etapa ${i + 1} de ${STEPS.length}`} width={480}
      footer={
        <>
          <Button variant="ghost" onClick={finish}>Pular guia</Button>
          <span style={{ flex: 1 }} />
          {i > 0 && <Button variant="outline" onClick={() => setI(i - 1)}>Voltar</Button>}
          {last ? <Button onClick={finish}>Concluir</Button> : <Button onClick={() => setI(i + 1)}>Avançar</Button>}
        </>
      }>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '10px 6px 4px' }}>
        <div style={{ width: 62, height: 62, borderRadius: 18, background: '#e9eeff', color: '#3f6bf5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <Icon name={s.icon} size={30} />
        </div>
        <div style={{ font: "800 16px 'Plus Jakarta Sans'", color: '#26324a', marginBottom: 8 }}>{s.title}</div>
        <div style={{ font: "500 13px/1.65 'Plus Jakarta Sans'", color: '#5b647a', maxWidth: 380 }}>{s.desc}</div>
        {s.to && (
          <button className="chip" onClick={() => goTo(s.to!)}
            style={{ marginTop: 14, padding: '8px 16px', borderRadius: 10, border: '1px solid #cdd8ff', background: '#e9eeff', color: '#2f52e0', font: "700 12.5px 'Plus Jakarta Sans'" }}>
            {s.cta} →
          </button>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 20 }}>
          {STEPS.map((_, j) => (
            <button key={j} onClick={() => setI(j)} aria-label={`Etapa ${j + 1}`}
              style={{ width: j === i ? 22 : 8, height: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: j === i ? '#3f6bf5' : '#d7ddea', transition: 'all .2s ease' }} />
          ))}
        </div>
      </div>
    </Modal>
  )
}
