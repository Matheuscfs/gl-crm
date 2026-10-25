import type { ReactNode } from 'react'
import { Section, F, Check, YesNo, Para, SignDate, type DocCtx } from './DocKit'
import { fmtHour } from '../../data'
import { historico, TOOTH, type ToothState } from '../../data'

const DEMO_ADULT: Record<string, unknown> = {
  queixa: 'Harmonização — linhas de expressão', doenca: false, medicamentos: false, alergia: false,
  cirurgia: false, anestesia: false, trat_previo: true, dor: false, sangramento: false, sensibilidade: false,
  escovacao: '3', fio: true, est_anteriores: true, est_anteriores_d: 'Toxina botulínica (2025)', toxina_previa: true, ah_previo: false, expectativas: 'Suavizar rugas de testa e glabela',
}
const nomeResp = (r?: string) => (r || '').split('·')[0].trim()

const brDate = (iso?: string) => {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

// valores de exemplo (usados quando não há anamnese salva)
const DEMO_PED: Record<string, unknown> = {
  queixa: 'Revisão e manutenção de aparelho', doenca: true, doenca_d: 'Asma', medicamentos: true, medicamentos_d: 'Salbutamol (em crise)',
  alergia: true, alergia_d: 'Penicilina', cirurgia: false, anestesia: false, trat_previo: true, exp_negativa: false, sedacao: false, contencao: false,
  dor: false, sangramento: false, sensibilidade: false, escovacao: '2', fio: true, creme_fluor: true, quem_escova: 'Supervisionado',
  gestacao: 'Normal', nascimento: 'Cesárea', habitos: ['Sucção de dedo'], doces: 'Às vezes', refri: 'Nunca', amamentacao: 'Materna', mamadeira_noturna: false, comportamento: 'Colaboradora',
}

const G2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2px 22px' }
const G3: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '2px 18px' }
const ROW: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0 6px', alignItems: 'baseline' }

/* ---------- 1. Prontuário / Anamnese Pediátrica ---------- */
function prontuarioPediatrico(b: boolean, ctx: DocCtx = {}): ReactNode {
  const A = { ...(ctx.demo ? DEMO_PED : {}), ...(ctx.anamnese ?? {}) } as Record<string, unknown>
  const habitos = Array.isArray(A.habitos) ? (A.habitos as string[]) : []
  const nome = ctx.patientName ?? ''
  const nasc = ctx.birthdate ? brDate(ctx.birthdate) : ''
  const sexF = ctx.sex === 'Feminino'
  const sexM = ctx.sex === 'Masculino'
  return (
    <>
      <Section>Identificação</Section>
      <F label="Nome da criança" value={nome} blank={b} />
      <div style={G3}>
        <F label="Data de nascimento" value={nasc} blank={b} />
        <F label="Idade" value="" blank={b} />
        <div style={ROW}><span className="doc-field-label">Sexo:</span><Check label="F" checked={sexF} blank={b} /><Check label="M" checked={sexM} blank={b} /></div>
      </div>

      <Section>Clínico</Section>
      <F label="Queixa principal" value={String(A.queixa ?? '')} blank={b} />
      <YesNo label="Possui doença/síndrome?" yes={A.doenca === true} detail={String(A.doenca_d ?? '')} blank={b} />
      <YesNo label="Uso de medicamentos contínuos?" yes={A.medicamentos === true} detail={String(A.medicamentos_d ?? '')} blank={b} />
      <YesNo label="Alergia?" yes={A.alergia === true} detail={String(A.alergia_d ?? '')} blank={b} />

      <Section>Histórico</Section>
      <div style={G2}>
        <YesNo label="Já realizou cirurgia?" yes={A.cirurgia === true} blank={b} />
        <YesNo label="Reação à anestesia?" yes={A.anestesia === true} blank={b} />
        <YesNo label="Tratamento odontológico prévio?" yes={A.trat_previo === true} blank={b} />
        <YesNo label="Experiência negativa?" yes={A.exp_negativa === true} blank={b} />
        <YesNo label="Já realizou sedação?" yes={A.sedacao === true} blank={b} />
        <YesNo label="Contenção física?" yes={A.contencao === true} blank={b} />
        <YesNo label="Apresenta dor atualmente?" yes={A.dor === true} blank={b} />
        <YesNo label="Sangramento gengival?" yes={A.sangramento === true} blank={b} />
      </div>
      <YesNo label="Sensibilidade dentária?" yes={A.sensibilidade === true} blank={b} />

      <Section>Higiene</Section>
      <div style={G2}>
        <F label="Escovação (vezes/dia)" value={String(A.escovacao ?? '')} blank={b} />
        <div style={ROW}><span className="doc-field-label">Uso de fio dental:</span><Check label="Não" checked={A.fio === false} blank={b} /><Check label="Sim" checked={A.fio === true} blank={b} /></div>
        <div style={ROW}><span className="doc-field-label">Creme fluoretado:</span><Check label="Não" checked={A.creme_fluor === false} blank={b} /><Check label="Sim" checked={A.creme_fluor === true} blank={b} /></div>
        <div style={ROW}><span className="doc-field-label">Quem escova:</span><Check label="Pais" checked={A.quem_escova === 'Pais'} blank={b} /><Check label="Criança" checked={A.quem_escova === 'Criança'} blank={b} /><Check label="Supervisionado" checked={A.quem_escova === 'Supervisionado'} blank={b} /></div>
      </div>

      <Section>Gestação, nascimento e hábitos</Section>
      <div style={G2}>
        <div style={ROW}><span className="doc-field-label">Gestação:</span><Check label="Risco" checked={A.gestacao === 'Risco'} blank={b} /><Check label="Normal" checked={A.gestacao === 'Normal'} blank={b} /></div>
        <div style={ROW}><span className="doc-field-label">Nascimento:</span><Check label="Normal" checked={A.nascimento === 'Normal'} blank={b} /><Check label="Cesárea" checked={A.nascimento === 'Cesárea'} blank={b} /></div>
      </div>
      <div style={{ ...ROW, marginTop: 4 }}>
        <span className="doc-field-label">Hábitos:</span>
        {['Chupeta', 'Mamadeira', 'Sucção de dedo', 'Roer unhas', 'Bruxismo', 'Respiração bucal'].map((h) => <Check key={h} label={h} checked={habitos.includes(h)} blank={b} />)}
      </div>

      <Section>Dieta e comportamento</Section>
      <div style={G2}>
        <div style={ROW}><span className="doc-field-label">Doces:</span>{['Nunca', 'Às vezes', 'Todos os dias'].map((o) => <Check key={o} label={o} checked={A.doces === o} blank={b} />)}</div>
        <div style={ROW}><span className="doc-field-label">Refrigerante:</span>{['Nunca', 'Às vezes', 'Todos os dias'].map((o) => <Check key={o} label={o} checked={A.refri === o} blank={b} />)}</div>
        <div style={ROW}><span className="doc-field-label">Amamentação:</span><Check label="Materna" checked={A.amamentacao === 'Materna'} blank={b} /><Check label="Fórmula" checked={A.amamentacao === 'Fórmula'} blank={b} /></div>
        <div style={ROW}><span className="doc-field-label">Mamadeira noturna:</span><Check label="Não" checked={A.mamadeira_noturna === false} blank={b} /><Check label="Sim" checked={A.mamadeira_noturna === true} blank={b} /></div>
      </div>
      <div style={{ ...ROW, marginTop: 4 }}>
        <span className="doc-field-label">Comportamento:</span>
        {['Muito tranquila', 'Ansiosa', 'Chora', 'Agressiva', 'Colaboradora'].map((o) => <Check key={o} label={o} checked={A.comportamento === o} blank={b} />)}
      </div>

      <Para>Autorizo a realização dos procedimentos odontológicos necessários e declaro serem verdadeiras as informações prestadas.</Para>
      <SignDate role="Responsável" blank={b} />
    </>
  )
}

/* ---------- 2. Prontuário / Anamnese Adulto ---------- */
function prontuarioAdulto(b: boolean, ctx: DocCtx = {}): ReactNode {
  const A = { ...(ctx.demo ? DEMO_ADULT : {}), ...(ctx.anamnese ?? {}) } as Record<string, unknown>
  const nome = ctx.patientName ?? ''
  const sexF = ctx.sex === 'Feminino'
  const sexM = ctx.sex === 'Masculino'
  return (
    <>
      <Section>Identificação</Section>
      <F label="Nome" value={nome} blank={b} />
      <div style={G3}>
        <F label="Data de nascimento" value={ctx.birthdate ? brDate(ctx.birthdate) : ''} blank={b} />
        <F label="Idade" value="" blank={b} />
        <div style={ROW}><span className="doc-field-label">Sexo:</span><Check label="F" checked={sexF} blank={b} /><Check label="M" checked={sexM} blank={b} /></div>
      </div>
      <F label="CPF" value={ctx.cpf ?? ''} blank={b} />

      <Section>Clínico</Section>
      <F label="Queixa principal" value={String(A.queixa ?? '')} blank={b} />
      <YesNo label="Possui doença?" yes={A.doenca === true} detail={String(A.doenca_d ?? '')} blank={b} />
      <YesNo label="Medicamentos contínuos?" yes={A.medicamentos === true} detail={String(A.medicamentos_d ?? '')} blank={b} />
      <YesNo label="Alergia?" yes={A.alergia === true} detail={String(A.alergia_d ?? '')} blank={b} />

      <Section>Histórico</Section>
      <div style={G2}>
        <YesNo label="Já realizou cirurgia?" yes={A.cirurgia === true} blank={b} />
        <YesNo label="Reação à anestesia?" yes={A.anestesia === true} blank={b} />
        <YesNo label="Tratamento odontológico prévio?" yes={A.trat_previo === true} blank={b} />
        <YesNo label="Apresenta dor atual?" yes={A.dor === true} blank={b} />
        <YesNo label="Sangramento gengival?" yes={A.sangramento === true} blank={b} />
        <YesNo label="Sensibilidade dentária?" yes={A.sensibilidade === true} blank={b} />
      </div>

      <Section>Higiene</Section>
      <div style={G2}>
        <F label="Escovação (vezes/dia)" value={String(A.escovacao ?? '')} blank={b} />
        <div style={ROW}><span className="doc-field-label">Uso de fio dental:</span><Check label="Não" checked={A.fio === false} blank={b} /><Check label="Sim" checked={A.fio === true} blank={b} /></div>
      </div>

      <Section>Procedimentos estéticos</Section>
      <YesNo label="Procedimentos estéticos anteriores?" yes={A.est_anteriores === true} detail={String(A.est_anteriores_d ?? '')} blank={b} />
      <YesNo label="Uso prévio de toxina botulínica?" yes={A.toxina_previa === true} blank={b} />
      <YesNo label="Uso prévio de ácido hialurônico?" yes={A.ah_previo === true} blank={b} />
      <F label="Expectativas do paciente" value={String(A.expectativas ?? '')} blank={b} />

      <Para>Declaro que as informações acima são verdadeiras e completas, assumindo responsabilidade por sua veracidade.</Para>
      <SignDate role="Paciente" blank={b} />
    </>
  )
}

/* ---------- 3. Odontograma (linhas de anotação) ---------- */
const MIX_SUP = ['17', '16', '15/55', '14/54', '13/53', '12/52', '11/51', '21/61', '22/62', '23/63', '24/64', '25/65', '26', '27']
const MIX_INF = ['47', '46', '45/85', '44/84', '43/83', '42/82', '41/81', '31/71', '32/72', '33/73', '34/74', '35/75', '36', '37']
const PERM_SUP = Array.from({ length: 8 }, (_, i) => String(18 - i)).concat(Array.from({ length: 8 }, (_, i) => String(21 + i)))
const PERM_INF = Array.from({ length: 8 }, (_, i) => String(48 - i)).concat(Array.from({ length: 8 }, (_, i) => String(31 + i)))

function annotationRows(list: string[], teethMap: Record<number, string>) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2px 22px' }}>
      {list.map((n) => {
        const cond = n.split('/').map((x) => teethMap[Number(x)]).find(Boolean)
        return (
          <div key={n} style={{ display: 'flex', gap: 6, padding: '4px 0', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 700, minWidth: 48, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{n}</span>
            <span className="doc-field-value">{cond ?? ''}</span>
          </div>
        )
      })}
    </div>
  )
}
function odontograma(b: boolean, ctx: DocCtx = {}, permanente = false): ReactNode {
  const teethMap: Record<number, string> = {}
  // condição do dente + faces anotadas ("Cárie (O, M)")
  if (!b) (ctx.teeth ?? []).forEach((t) => { if (t.state !== 'higido' || t.faces) teethMap[t.num] = t.faces || (TOOTH[t.state as ToothState]?.label ?? '') })
  const lay = ctx.dentLayout
  return (
    <>
      <div style={{ textAlign: 'center', fontStyle: 'italic', color: '#777', fontSize: 11, marginBottom: 8 }}>
        {lay ? lay.titulo : permanente ? 'Dentição permanente (18–28 / 48–38)' : 'Dentição decídua/mista'}
      </div>
      {ctx.patientName && !b && <F label="Paciente" value={ctx.patientName} blank={b} />}
      <Section>Arcada superior</Section>
      {annotationRows(lay ? lay.sup : permanente ? PERM_SUP : MIX_SUP, teethMap)}
      <Section>Arcada inferior</Section>
      {annotationRows(lay ? lay.inf : permanente ? PERM_INF : MIX_INF, teethMap)}
      <div style={{ marginTop: 14, fontSize: 11, color: '#777' }}>
        Faces: M mesial · D distal · O oclusal / I incisal · V vestibular · L lingual / P palatina.
      </div>
    </>
  )
}

/* ---------- 4. Tratamentos executados ---------- */
function tratamentos(b: boolean, ctx: DocCtx = {}): ReactNode {
  const real = ctx.treatments && ctx.treatments.length
    ? ctx.treatments
    : ctx.demo ? historico.map((h) => ({ date: h.date, proc: h.proc })) : []
  const rows = b || real.length === 0 ? Array.from({ length: 14 }, () => ({ date: '', proc: '' })) : real
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', borderBottom: '1.5px solid #555', padding: '6px 8px', width: 110 }}>Data</th>
          <th style={{ textAlign: 'left', borderBottom: '1.5px solid #555', padding: '6px 8px' }}>Procedimento executado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ borderBottom: '1px dotted #bbb', padding: '9px 8px', fontFamily: "'JetBrains Mono', monospace" }}>{r.date}</td>
            <td style={{ borderBottom: '1px dotted #bbb', padding: '9px 8px' }}>{r.proc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ---------- Ficha de Evolução ---------- */
function fichaEvolucao(b: boolean, ctx: DocCtx = {}): ReactNode {
  const real = ctx.evolucoes && ctx.evolucoes.length
    ? ctx.evolucoes
    : ctx.treatments && ctx.treatments.length
      ? ctx.treatments
      : ctx.demo ? historico.map((h) => ({ date: h.date, proc: h.proc, prof: h.prof, note: h.note })) : []
  // sem evoluções registradas, o "preenchido" sai com linhas em branco para preencher à mão
  const rows = b || real.length === 0 ? Array.from({ length: 12 }, () => ({ date: '', proc: '', prof: '', note: '' })) : real
  const th: React.CSSProperties = { textAlign: 'left', borderBottom: '1.5px solid #555', padding: '6px 8px' }
  const td: React.CSSProperties = { borderBottom: '1px dotted #bbb', padding: b ? '16px 8px' : '9px 8px', verticalAlign: 'top' }
  return (
    <>
      <div style={G2}>
        <F label="Paciente" value={ctx.patientName ?? ''} blank={b} />
        <F label="Data de nascimento" value={ctx.birthdate ? brDate(ctx.birthdate) : ''} blank={b} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 10 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 92 }}>Data</th>
            <th style={{ ...th, width: 170 }}>Procedimento</th>
            <th style={th}>Evolução / observações</th>
            <th style={{ ...th, width: 72 }}>Rubrica</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ ...td, fontFamily: "'JetBrains Mono', monospace" }}>{r.date}</td>
              <td style={td}>{r.proc}</td>
              <td style={td}>{r.note ?? ''}</td>
              <td style={td} />
            </tr>
          ))}
        </tbody>
      </table>
      <Para>Declaro que as evoluções acima correspondem aos atendimentos realizados.</Para>
      <SignDate role="Cirurgiã Dentista" blank={b} />
    </>
  )
}

/* ---------- 5. TCLE ---------- */
function tcle(b: boolean, ctx: DocCtx = {}): ReactNode {
  return (
    <>
      <div style={G2}>
        <F label="Nome" value={ctx.patientName ?? ''} blank={b} />
        <F label="CPF" value={ctx.cpf ?? ''} blank={b} />
      </div>
      <Para>Declaro que fui devidamente esclarecido(a) pela profissional a respeito de (marque cada item):</Para>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4, marginLeft: 4 }}>
        <Check label="Diagnóstico clínico" blank={b} />
        <Check label="Objetivos do tratamento" blank={b} />
        <Check label="Benefícios esperados" blank={b} />
        <Check label="Riscos e complicações possíveis" blank={b} />
        <Check label="Necessidade de colaboração do paciente/responsável" blank={b} />
        <Check label="Alternativas terapêuticas" blank={b} />
        <Check label="Possibilidade de alterações no plano de tratamento" blank={b} />
      </div>
      <Para>
        Estou ciente de que a Odontologia não é uma ciência exata e que <b>não há garantia de resultado</b>; de que podem
        ocorrer intercorrências durante ou após os procedimentos; e comprometo-me a seguir as orientações e recomendações
        pós-operatórias fornecidas pela profissional.
      </Para>
      <Para>Autorizo a realização do tratamento proposto, tendo esclarecido todas as minhas dúvidas.</Para>
      <SignDate role="Paciente ou responsável" blank={b} />
    </>
  )
}

/* ---------- 6. Autorização de uso de imagem ---------- */
function autorizacaoImagem(b: boolean, ctx: DocCtx = {}): ReactNode {
  return (
    <>
      <div style={G2}>
        <F label="Nome" value={ctx.patientName ?? ''} blank={b} />
        <F label="CPF" value={ctx.cpf ?? ''} blank={b} />
      </div>
      <Para>Autorizo o uso de imagens (fotografias e/ou vídeos) do tratamento para as seguintes finalidades:</Para>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4, marginLeft: 4 }}>
        <Check label="Registro clínico" blank={b} />
        <Check label="Discussões científicas e aulas" blank={b} />
        <Check label="Publicações em artigos" blank={b} />
        <Check label="Redes sociais profissionais" blank={b} />
        <Check label="Site profissional" blank={b} />
        <Check label="Material educativo" blank={b} />
      </div>
      <Para>
        Estou ciente de que as imagens poderão ser utilizadas sem identificação nominal e que esta autorização pode ser
        revogada a qualquer momento mediante solicitação por escrito.
      </Para>
      <div style={{ ...ROW, marginTop: 8, fontSize: 13 }}>
        <Check label="Autorizo" blank={b} /><Check label="Não autorizo" blank={b} />
      </div>
      <SignDate role="Paciente ou responsável" blank={b} />
    </>
  )
}

/* ---------- 7. Autorização de atendimento de menor ---------- */
function autorizacaoMenor(b: boolean, ctx: DocCtx = {}): ReactNode {
  const rel = (ctx.resp || '').split('·')[1]?.trim().toLowerCase()
  return (
    <>
      <Section>Responsável</Section>
      <div style={G2}>
        <F label="Nome do responsável" value={nomeResp(ctx.resp)} blank={b} />
        <F label="CPF" value={ctx.respCpf ?? ''} blank={b} />
      </div>
      <div style={{ ...ROW, marginTop: 4 }}>
        <span className="doc-field-label">Qualidade:</span>
        <Check label="Pai" checked={rel === 'pai'} blank={b} /><Check label="Mãe" checked={rel === 'mãe'} blank={b} /><Check label="Responsável legal" blank={b} />
      </div>
      <Section>Menor</Section>
      <div style={G2}>
        <F label="Nome do menor" value={ctx.patientName ?? ''} blank={b} />
        <F label="Data de nascimento" value={ctx.birthdate ? brDate(ctx.birthdate) : ''} blank={b} />
      </div>
      <Para>Autorizo a realização dos seguintes procedimentos no(a) menor sob minha responsabilidade:</Para>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4, marginLeft: 4 }}>
        <Check label="Consulta" blank={b} /><Check label="Exame clínico" blank={b} />
        <Check label="Radiografias" blank={b} /><Check label="Profilaxia" blank={b} />
        <Check label="Aplicação tópica de flúor" blank={b} /><Check label="Selantes" blank={b} />
        <Check label="Restaurações" blank={b} /><Check label="Anestesia local" blank={b} />
        <Check label="Outros, mediante informação prévia" blank={b} />
      </div>
      <SignDate role="Responsável" blank={b} />
    </>
  )
}


/* ---------- 8. Receituário (simples ou de controle especial, 2 vias) ---------- */
function receituario(b: boolean, ctx: DocCtx = {}): ReactNode {
  const r = ctx.emissao?.receita
  const itens = !b && r?.itens?.length ? r.itens : Array.from({ length: 3 }, () => ({ med: '', qtd: '', posologia: '' }))
  const via = (n: number) => (
    <div key={n} style={n > 1 ? { marginTop: 22, paddingTop: 16, borderTop: '1.5px dashed #999' } : undefined}>
      {r?.controleEspecial && <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 700 }}>{n}ª via — {n === 1 ? 'farmácia' : 'paciente'}</div>}
      <F label="Paciente" value={ctx.patientName ?? ''} blank={b} />
      <F label="Uso" value={r?.uso ?? ''} blank={b} />
      <ol style={{ margin: '12px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {itens.map((it, i) => (
          <li key={i} style={{ fontSize: 12.5 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <b className="doc-field-value" style={{ flex: 1 }}>{b ? '' : it.med}</b>
              <span className="doc-field-value" style={{ minWidth: 110, textAlign: 'right' }}>{b ? '' : it.qtd}</span>
            </div>
            <div className="doc-field-value" style={{ marginTop: 4, minHeight: 16 }}>{b ? '' : it.posologia}</div>
          </li>
        ))}
      </ol>
      {r?.controleEspecial && (
        <>
          <Section>Identificação do comprador</Section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2px 22px' }}>
            <F label="Nome" blank /><F label="RG" blank /><F label="Endereço" blank /><F label="Telefone" blank />
          </div>
          <Section>Identificação do fornecedor</Section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2px 22px' }}><F label="Farmacêutico" blank /><F label="Data" blank /></div>
        </>
      )}
      <SignDate role="Cirurgiã Dentista · assinatura e carimbo" blank={b} date={ctx.emissao?.data} />
    </div>
  )
  return <>{via(1)}{r?.controleEspecial && via(2)}</>
}

/* ---------- 9. Atestado odontológico ---------- */
function atestado(b: boolean, ctx: DocCtx = {}): ReactNode {
  const a = ctx.emissao?.atestado
  const dataBr = brDate(ctx.emissao?.data)
  const horas = a ? `das ${fmtHour(Number(a.inicio))} às ${fmtHour(Number(a.fim))}` : ''
  return (
    <>
      <Para>
        Atesto, para os devidos fins{a?.finalidade && !b ? ` (${a.finalidade})` : ''}, que{' '}
        <b className="doc-field-value" style={{ display: 'inline-block', minWidth: 220 }}>{b ? '' : ctx.patientName}</b>
        {ctx.cpf && !b ? <>, CPF {ctx.cpf},</> : ''} esteve sob meus cuidados profissionais no dia{' '}
        <span className="doc-field-value" style={{ display: 'inline-block', minWidth: 90 }}>{b ? '' : dataBr}</span>{' '}
        <span className="doc-field-value" style={{ display: 'inline-block', minWidth: 120 }}>{b ? '' : horas}</span>
        {(b || (a && a.dias > 0)) ? (
          <>, necessitando de <span className="doc-field-value" style={{ display: 'inline-block', minWidth: 30, textAlign: 'center' }}>{b ? '' : a!.dias}</span>{' '}
          dia(s) de afastamento de suas atividades a partir desta data.</>
        ) : '.'}
      </Para>
      {(b || (a?.cid && a.cidAutorizado)) && (
        <F label="CID (incluído a pedido e com autorização do paciente)" value={a?.cid ?? ''} blank={b} />
      )}
      <SignDate role="Cirurgiã Dentista · assinatura e carimbo" blank={b} date={ctx.emissao?.data} />
    </>
  )
}

/* ---------- 10. Declaração de comparecimento ---------- */
function declaracao(b: boolean, ctx: DocCtx = {}): ReactNode {
  const d = ctx.emissao?.declaracao
  const dataBr = brDate(ctx.emissao?.data)
  const horas = d ? `das ${fmtHour(Number(d.inicio))} às ${fmtHour(Number(d.fim))}` : ''
  const acompanhante = d?.para === 'acompanhante'
  return (
    <>
      <Para>
        Declaro, para os devidos fins, que{' '}
        <b className="doc-field-value" style={{ display: 'inline-block', minWidth: 220 }}>{b ? '' : acompanhante ? d?.acompanhante : ctx.patientName}</b>{' '}
        {acompanhante && !b ? <>esteve presente neste consultório acompanhando o(a) paciente <b>{ctx.patientName}</b></> : 'compareceu a este consultório para atendimento odontológico'}{' '}
        no dia <span className="doc-field-value" style={{ display: 'inline-block', minWidth: 90 }}>{b ? '' : dataBr}</span>,{' '}
        <span className="doc-field-value" style={{ display: 'inline-block', minWidth: 120 }}>{b ? '' : horas}</span>.
      </Para>
      <SignDate role="Cirurgiã Dentista · assinatura e carimbo" blank={b} date={ctx.emissao?.data} />
    </>
  )
}

export interface DocDef {
  key: string
  title: string
  // 'adulto' abrange documentos de adulto (usados tanto por perfil Adulto quanto Estético)
  perfil: 'pediatrico' | 'adulto' | 'ambos'
  node: (blank: boolean, ctx: DocCtx) => ReactNode
  /** Documento emitido na hora: abre um formulário antes de gerar. */
  emitir?: 'receita' | 'atestado' | 'declaracao'
}

export const DOCUMENTS: DocDef[] = [
  { key: 'pront_ped', title: 'Prontuário / Anamnese Pediátrica', perfil: 'pediatrico', node: prontuarioPediatrico },
  { key: 'pront_adt', title: 'Prontuário / Anamnese Adulto', perfil: 'adulto', node: prontuarioAdulto },
  { key: 'odonto', title: 'Odontograma', perfil: 'ambos', node: (b, ctx) => odontograma(b, ctx, false) },
  { key: 'odonto_perm', title: 'Odontograma Permanente', perfil: 'adulto', node: (b, ctx) => odontograma(b, ctx, true) },
  { key: 'tratamentos', title: 'Tratamentos Executados', perfil: 'ambos', node: tratamentos },
  { key: 'evolucao', title: 'Ficha de Evolução', perfil: 'ambos', node: fichaEvolucao },
  { key: 'tcle', title: 'Termo de Consentimento (TCLE)', perfil: 'ambos', node: tcle },
  { key: 'img', title: 'Autorização de Uso de Imagem', perfil: 'ambos', node: autorizacaoImagem },
  { key: 'menor', title: 'Autorização de Atendimento de Menor', perfil: 'pediatrico', node: autorizacaoMenor },
  { key: 'receita', title: 'Receituário', perfil: 'ambos', node: receituario, emitir: 'receita' },
  { key: 'atestado', title: 'Atestado Odontológico', perfil: 'ambos', node: atestado, emitir: 'atestado' },
  { key: 'declaracao', title: 'Declaração de Comparecimento', perfil: 'ambos', node: declaracao, emitir: 'declaracao' },
]

// "Pacote de admissão" por grupo de documentos (pediátrico x adulto)
export const ADMISSION: Record<'pediatrico' | 'adulto', string[]> = {
  pediatrico: ['pront_ped', 'menor', 'img', 'tcle'],
  adulto: ['pront_adt', 'img', 'tcle'],
}
