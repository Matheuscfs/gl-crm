# Plano de implementação — GL CRM

Auditoria de 14/10/2026: três revisões de código (esqueleto/design system, telas operacionais,
ficha do paciente + financeiro/estoque) e navegação no modo demonstração em 1440, 768 e 375 px.
Cerca de 170 achados, todos com arquivo:linha conferido. Este arquivo é o checklist vivo:
marque `[x]` ao concluir.

## Diagnóstico

Todas as telas existem e o typecheck passa limpo. O que falta é de três tipos:

1. **Layout só funciona no desktop.** As grades de cada tela estão em `style={{}}` inline
   (52 `gridTemplateColumns`), e media query não alcança estilo inline. No celular a Agenda e o
   Financeiro se sobrepõem; no tablet as tabelas quebram valor em duas linhas.
2. **O app finge.** Botões que só mostram toast ("Contatar", "Enviar cobrança", "Baixar",
   "Compartilhar"), salvamentos com `setTimeout` que anunciam sucesso antes do banco responder,
   e dados de demonstração vazando para documentos reais (anamnese com "Asma, Salbutamol",
   data "17 de julho de 2026", mapa facial com 30U já marcadas, CNPJ `00.000.000/0001-00`).
3. **O store identifica registro por nome e não tem estado de carga/erro.** Renomear paciente
   ou material não salva (e mostra "atualizado"); homônimos colidem; falha de rede vira tela vazia.

## O que já está bom

- `tsc -b` sem erros; login + RLS fechada; fotos em bucket privado com URL assinada.
- Todas as abas da ficha implementadas (`Placeholder.tsx` é código morto).
- Shell de tablet (tab bar + folha "Mais"), alvos de toque de 44 px em `pointer: coarse`,
  viewport e `prefers-reduced-motion` corretos.
- Parcelamento/carnê do plano corrigido no commit 5a59ce0.

## Infraestrutura (15/10/2026)

- **Supabase:** projeto GL CRM `qkgmlmlzahcsmxqwhgjr` (fora da org Aura; o MCP não alcança).
  Migrações 0001–0025 aplicadas pelo SQL Editor, sem `0002_seed` e `0008_seed_estetico`.
  Conferido pela API: as 27 tabelas existem e o acesso anônimo é negado (RLS da 0025).
- **GitHub:** `auralink-dev/gl-crm` (privado) é o `origin`, com `main` e
  `front/fundacao-responsiva`; o repositório antigo ficou como remoto `matheus`.
  Commits saem como Aura Health (auralink-dev): no plano Hobby a Vercel só publica sozinha
  commits do dono da conta.
- **Vercel:** projeto `gl-crm` no time auraconnect-dev, ligado a `auralink-dev/gl-crm`,
  variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_DEMO_DATA=0`
  (produção e preview). Produção em https://gl-crm-delta.vercel.app, publicada manualmente a
  partir de `front/fundacao-responsiva`; pushes em `main` passam a publicar sozinhos.
**No painel (15/10/2026, feito pelo usuário e conferido pela API pública e pelo painel):**
- [x] SQL Editor: `0026_prontuario_automacao.sql` e `0027_equipe_acesso.sql` aplicadas (`horarios_livres`
      responde ao visitante; `minha_situacao` existe e recusa anônimo; `patients` fechada para anônimo).
- [x] Authentication → URL Configuration: Site URL `https://gl-crm-delta.vercel.app` e, em
      Redirect URLs, `https://gl-crm-delta.vercel.app/**` (links de confirmação e de nova senha).
- [x] Authentication → Sign In / Providers: cadastro por e-mail ligado (com confirmação). A Dra. cria a conta pela
      tela "Criar conta"; depois da 0027 o primeiro login vira administradora e libera a equipe.
- [x] Checagens do Security Advisor (as mesmas do splinter: RLS, views, `search_path`, `security
      definer`, políticas `true`, `user_metadata`, buckets e grants) sobre 0001–0027 no Postgres de
      teste: 2 avisos, corrigidos na `0028_ajustes_seguranca.sql` (sem achados depois dela; auditoria
      e bloqueio de exclusão conferidos com usuário comum da equipe).
- [x] `0028_ajustes_seguranca.sql` aplicada em produção (com autorização do usuário, pelo SQL Editor):
      as duas funções de gatilho com `search_path=public` e sem EXECUTE para anon/authenticated.
- [x] Security Advisor do painel, rodado de novo depois da 0028: **0 erros**, 7 avisos esperados — todos
      "SECURITY DEFINER executável" em funções que precisam ser chamadas: `horarios_livres` e
      `solicitar_agendamento` (agendamento online, sem login), `is_equipe`/`is_admin` (usadas pelo RLS em
      cada consulta) e `minha_situacao` (chamada no login). Tirar o acesso quebraria o app.

**Fora do escopo por decisão do usuário (15/10/2026: "não criar a automação e o Asaas ainda"): automação pelo WhatsApp oficial e cobrança Asaas.** O código está pronto
(`supabase/functions/`, testado), mas ligar depende de contas que só o usuário pode criar — WhatsApp
Business na Meta (com aprovação dos modelos de mensagem e custo por conversa) e Asaas — e de colar as
chaves delas como segredos no Supabase. Até lá o app funciona com os botões de WhatsApp manuais, e a
tela de Relacionamento já diz que o envio é manual. Para ligar: guia em `supabase/functions/README.md`
(publicar as funções, cadastrar os segredos e `CRON_SECRET`, rodar `supabase/automacao/agendar_cron.sql`
e ligar em Configurações → Automação).

---

## Fase 0 — Redesenho aprovado (linha visual Aura+)

Proposta aprovada em 14/10/2026 no canvas https://claude.ai/artifact/Ht1SoizN7wQB5UbB5hMrei
(9 telas: Início, Agenda, Pacientes, Ficha/plano, Financeiro, Resumo tablet, Agenda/Pacientes/Mais celular).

- [x] Paleta violeta, fundo pastel, cartões sem borda com sombra suave, títulos em peso leve.
- [x] Menu lateral em cartão (pílula ativa, subitens, contadores, conta no rodapé, modo recolhido).
- [x] Barra superior global: trilha, busca com Ctrl+K sem acento, sino e situação da conexão.
- [x] Início: pendências, Fila do dia, aviso de retornos, "Quem chamar primeiro" e indicadores.
- [x] Agenda no novo layout: filtro por situação, cartões com a situação escrita, painel "A confirmar" e horários livres.
- [x] Pacientes no novo layout: busca sem acento, perfis com contagem, urgentes primeiro, painel lateral.
- [x] Ficha do paciente no novo layout: cartão do paciente, alertas por extenso, abas em pílula,
      aba Plano e orçamento redesenhada (desconto validado, aprovação com confirmação, carnê na tela).
      Em tela baixa ou estreita a ficha rola inteira e só a barra de abas fica presa.
- [x] Financeiro no novo layout: destaque do vencido (de qualquer mês) com cobrança direta,
      indicadores, contas a receber com filtro por situação e ação principal por linha,
      recebido em 7 meses, Carnê-Leão e lançamentos; período inclui os próximos 3 meses.
- [x] Abas antigas da ficha (Dados, Anamnese, Odontograma, Tratamentos, Evolução, Financeiro,
      Documentos, Mapa facial, Antes e depois) em classes responsivas: nada estoura de lado em
      375 px; dentes do odontograma encolhem; no tablet em pé o dente selecionado vem logo
      depois da arcada; editor de projeção empilha o painel de ferramentas.
- [x] Tablet e celular no novo layout: Resumo (pendências, destaques, fila do dia), folha "Mais",
      Agenda do celular (faixa de dias + cartões com "Confirmar") e Pacientes em cartões.
- [x] Linha Apple (pedido de 14/10): fonte San Francisco nos aparelhos Apple e Inter nos demais,
      títulos em negrito com espaçamento justo, números em SF Rounded; ícone cheio na aba ativa;
      folha "Mais" com ícones coloridos como o app Ajustes; Resumo no estilo Destaques do Saúde.
- [x] Menu lateral: ícones se desenham ao passar o mouse; recolher/expandir suave sem os ícones
      pularem; alça na borda direita do cartão (aparece ao passar o mouse) e atalho Ctrl+B.
- [x] Tema escuro por variáveis: `:root[data-theme='dark']` redefine as cores; ~230 cores fixas do CSS
      e das telas viraram variáveis (papel impresso continua branco). Seletor Claro/Escuro/Automático
      no menu da conta e na folha "Mais"; aplicado antes da primeira pintura (sem piscar).
- [x] Do guia "Aura viva" (sessão do painel hospitalar), só o compatível com a linha Apple:
      pílula que desliza no menu, entrada das telas em sequência (rise), confirmação própria
      (`pedirConfirmacao`) no lugar do `window.confirm`; janelas por portal no `<body>`.
- [x] Menu lateral: ícones Lucide em violeta, sem fundo (como a barra lateral do macOS).
- [x] Visualização 3D (Three.js, carregado sob demanda em pacote separado de ~590 KB):
      odontograma 3D com dentes modelados em código, gengiva, rotação, seleção por toque e vistas
      Frente / Arcada superior / Arcada inferior (com opção 2D). Antes/Depois com alça de comparação
      arrastável (mouse, dedo e teclado) e ilustração em traço fino por ângulo no lugar do rosto antigo.
- [x] Ajustes do 3D (14/10): dentes anatômicos (borda incisal, ponta do canino, cúspides e sulcos),
      raízes visíveis com gengiva translúcida, câmera vai até o dente escolhido; cores pela convenção
      clínica (vermelho = a tratar, azul = tratado) também no odontograma 2D.
- [x] Mapa facial volta a 2D (pedido de 14/10): rosto ilustrado (pele com degradê, sombreamento,
      olhos, lábios, cabelo preso), zonas clicáveis (também pelo teclado) e pontos de aplicação
      (~1 a cada 2U); o busto 3D e o arquivo do MediaPipe saíram.
- [x] Login no modelo do painel Aura+ (15/10): título em dois tons, cartões ilustrativos em
      sequência, cartão de entrada com olho na senha, aviso de Caps Lock e "Esqueceu a senha?"
      no rótulo; contêiner de 1160 px (não espalha em tela larga), uma coluna no tablet e no celular.
      Logo da Dra. sendo escrita (`LogoAnimada`): máscara SVG segue o traço do G e do L sobre a
      imagem original, o texto aparece da esquerda para a direita e a borboleta voa e pousa na
      ponta do L (camadas recortadas do `logo-gl.png`; parada com "reduzir movimento").
- [x] Fontes e cores do login no app (15/10): tokens `--title-2` e `--grad-primary`; títulos em
      700 com entreletra apertada e o nome da Dra. na segunda cor (Início e Resumo); painéis com
      raio 22 e títulos em 700; degradê violeta no botão principal, nas chamadas (`.btn-cta`),
      na pílula do menu e no contador; brilhos do fundo na mesma disposição do login. Corrigida
      a `.legend-row` duplicada (a do odontograma virou `.cond-legend` e quebrava a legenda do
      Início e da Agenda).

## Fase 1 — Front-end: fundação visual e responsiva

- [x] **Tokens** em `styles.css`: `--primary*` (alias dos `--teal*`, que hoje guardam azul),
      `--brand-pink`, `--danger`/`--success` semânticos, `--text-2` com contraste AA
      (`--muted #8b93a7` dá ~3:1), `--focus-ring`, sombras e escala de z-index.
- [x] **Restos da paleta teal**: hover verde no botão primário, `.btn-teal-soft:hover` menta,
      cinzas esverdeados, sombras `rgba(15,40,45)`.
- [x] **Anel de foco visível** (hoje ~1,5:1, reprova WCAG 1.4.11).
- [x] **Fonte com fallback**: 362 `font: "… 'Plus Jakarta Sans'"` inline sem família genérica →
      texto em Times enquanto a fonte carrega ou offline. Trocar por `var(--font)`.
- [x] **Grades responsivas**: classes `.grid-kpi`, `.split`, `.split-aside`, `.field-row` que
      colapsam; todas as telas migradas (Relatórios e Configurações por último; Estoque e
      FichaProcedimento rolam a tabela de lado no celular com `.table-x`).
- [x] **Shell**: "Sair" na folha "Mais" (hoje não há como sair no tablet/celular); folha fecha
      ao tocar na página atual e com Esc; menu lateral rola em telas baixas (1366×768 esconde
      Ajuda/Configurações/avatar); Esc fecha só a camada de cima (hoje fecha popup + modal).
- [x] **Login**: Enter no modo "Esqueci minha senha" tenta logar.
- [x] **Textos**: Dashboard diz "Bom dia" a qualquer hora; no modo demo o Resumo diz
      "dados sincronizados com o Supabase" e fica preso em "conectando ao banco…".
- [x] **A11y básica**: `aria-label` nos botões só-ícone (‹ › da Agenda, sino, avatar),
      toast com `aria-live` e acima do overlay de impressão, busca do iPhone com 16 px.

## Fase 2 — Front-end: parar de fingir (sem migração de banco)

**Ações que só mostram toast**
- [x] Dashboard "Contatar"/"Reavaliar" → `waLink` + `window.open` (como a Agenda); `div` → `button`.
- [x] FinanceiroPaciente "Enviar cobrança" → agora abre o WhatsApp com o lembrete da parcela.
- [x] Documentos "Baixar"/"Renomear"; Odontograma "Compartilhar"/"Exportar imagem"/"Filtrar" → removidos (só mostravam aviso).
- [x] Salvamentos com `setTimeout` (Pacientes, Agenda, CRM, Anamnese, Estoque): toast só depois da resposta.

**Demonstração vazando para dados reais**
- [x] `templates.tsx:32,105` mistura `DEMO_PED`/`DEMO_ADULT` na anamnese real do documento.
- [x] `templates.tsx` nomes fictícios como padrão e consentimentos (TCLE, uso de imagem) já marcados.
- [x] `MapaFacial.tsx:21` começava com testa 10 / glabela 8 / pés de galinha 6+6 para todo paciente (agora só na demonstração).
- [x] `data.ts:168` `isSeedPatient` ignora `DEMO_DATA` (homônimo do seed herda plano/anamnese demo).
- [x] `Configuracoes.tsx:24-36` CNPJ/telefone/equipe fictícios podem ser gravados e sair no recibo.

**Datas**
- [x] `DocKit.tsx:141` assinatura "17 de julho de 2026" em todo documento.
- [x] `Estoque.tsx:24` data de entrada fixa `'17/08'`.
- [x] `Financeiro.tsx:117` recibo datado no vencimento, não no pagamento (agora sai com a data da emissão).
- [x] Parcelas de demonstração com vencimento fixo em jun/jul → relativas a hoje (o mês atual aparecia vazio).
- [x] `data.ts:194` `idadeLabel` com `new Date('AAAA-MM-DD')` (UTC → dia anterior no Brasil).
- [x] `Estoque.tsx:27,428` validade: item que vence hoje aparece "vencido".
- [x] `CRM.tsx:243` preview do WhatsApp fixo "amanhã, 19/07".

**Renomear e valores**
- [x] `Pacientes.tsx:127`: atualizava pelo nome novo → nada salvava (corrigido; agora também bloqueia nome duplicado).
- [x] `Estoque.tsx:241`: mesmo bug ao renomear material.
- [x] `Dados.tsx:41`: renomear quebra a rota (URL usa o nome).
- [x] `money.ts:4` / `fmt.ts:8` `parseMoney`: "180.50" vira 18050 (teclado decimal do tablet); aceita negativo.

**Agenda**
- [x] Setas não andam na visão Diária; Mensal ancorada na segunda-feira da semana.
- [x] Data vazia aceita (vira 1900 e o agendamento some).
- [x] Redimensionar grava no banco a cada `pointermove` (o fim da grade já usa `AGENDA_END` e respeita o expediente).
- [x] "Cancelar consulta" apaga o registro em vez de marcar `desmarcado`.

**Regras que a tela mostra errado**
- [x] "Retorno vencido" depende do campo `late`, que nenhum código grava → nunca aparece.
      Derivar de `next` vs hoje; concluir atendimento deve atualizar `last`/`next`.
- [x] Idade congelada no texto do cadastro → calcular da data de nascimento (lista, filtro e exportação).
- [x] Relatórios "Origem de leads" usa o texto livre do lead como origem ("19/07", "Plano #218").
- [x] "Atendimentos hoje" e visão Mensal contam desmarcados.

**Impressão**
- [x] Odontograma "Imprimir" sai em branco (CSS de print esconde tudo fora de `.doc-sheet`).
- [x] Recibo com cabeçalho e assinatura duplicados.
- [x] Dados da clínica fixos no código (DocKit, Recibo, Evolução) → `useClinic()`.
- [x] `@media print`: overlay estático para pacotes com várias folhas — conferido com PDF real (Chrome):
      pacote adulto = 3 folhas em 3 páginas; anamnese pediátrica longa continua na 2ª página com a
      mesma margem. Achado no teste: ao imprimir, a largura muda para a da folha A4, o app trocava de
      layout (desktop ↔ tablet) e desmontava o documento — **toda impressão em tela larga saía em
      branco**. As media queries agora ficam congeladas durante a impressão (`useTablet.ts`).

**Confirmação e validação**
- [x] ConfirmDialog em: item do plano, lançamento, aprovar plano.
- [x] ConfirmDialog em: atendimento, responsável, "Limpar marcadores", remover acesso. Marcar pago
      ficou sem confirmação porque tem "Reabrir" logo ao lado (desfazer em vez de perguntar).
- [x] Validar desconto do plano (0…subtotal).
- [x] Validar: quantidades de estoque (> 0, ≤ saldo), unidades do mapa (> 0).

## Fase 3 — Store: carregamento, erros e identidade

- [x] Expor `loading`/`error` no store; `ErrorState` com "Tentar de novo" (existe e não é usado);
      ficha do paciente sem "Paciente não encontrado" durante o F5.
- [x] Erros do Supabase com toast + rollback (store, `useCollection`, Financeiro, CRM).
- [x] Ids `tmp…`: bloquear escrita até o id real chegar (hoje perde edição em silêncio).
- [x] **Identidade por `_id`**: rota `/pacientes/:id`, update/delete por id, `key` por id;
      `whats.ts` casa só primeiro nome → mensagem pode ir ao responsável errado (LGPD).
- [x] Concluir atendimento: confirmação + idempotência (hoje cobra e baixa estoque de novo
      se o status voltar a "Concluído") e não cobrar procedimento já coberto por plano aprovado.
- [x] Procedimento casado por `includes` no nome ("Consulta" cobra "1ª consulta / avaliação").
- [x] `select('*')` sem paginação: limite de 1000 linhas → agenda por janela de datas.
- [x] Performance: `value` do store recriado a cada render (re-render do app a cada `pointermove`).

## Fase 4 — Precisa de migração no banco

O MCP não alcança o projeto `qkgmlmlzahcsmxqwhgjr`: tudo foi para `0026_prontuario_automacao.sql`
(testada em Postgres embutido junto com 0001–0025 e a 0027), a aplicar à mão no SQL Editor.

- [x] `installments.pago_em` — faturamento pela data de pagamento e recibo na data certa.
- [x] `appointments.patient_id`, `procedimento_id`, `gcal_id`, `cobrado_em`.
- [x] Movimentações de estoque persistidas (hoje só em memória).
- [x] `photo_sessions` (tabela já existe na 0004) ligada às fotos; `documents.storage_path` (upload real).
- [x] `clinic_settings.cidade` (PIX usa o endereço cortado em 15 caracteres como cidade).

## Fase 5 — Consistência e limpeza

- [x] Hex inline → tokens: de 804 para 131 cores fixas nas telas, todas de propósito — cor de dado
      (regiões da face, gráficos, situação), ilustração, ícones no estilo Ajustes do iPhone, a prévia
      do WhatsApp e o papel impresso. As que quebravam o tema escuro (caixas claras em Pacientes,
      legenda da Agenda, texto vinho em Planos) viraram tokens.
- [x] Unificar: `StatCard`/`FinCard`/`Kpi` (Relatórios usa o `StatCard`; `FinCard` saiu); um helper de
      moeda (`money.ts`); `PrintDoc` e `DocumentViewer` sobre o mesmo `DocOverlay` (portal, Esc, nome
      do PDF); `PatientPicker`/`ProcPicker` da Agenda sobre o `SuggestInput` (setas + Enter, busca sem acento).
- [x] Variante `danger` no Button; `ConfirmDialog` com `cancelLabel`; Modal com portal e devolução de
      foco; calendário, menu "⋮", filtros e sugestões num `Popover` por portal (não cortam dentro de
      modal, abrem para cima sem espaço). Clicar fora agora fecha também dentro de modal.
- [x] Notificações e busca global no Layout (hoje só no Dashboard desktop); "lido" com período.
- [x] PWA: `registerType: 'prompt'` + toast "Nova versão" (hoje recarrega sozinho e perde modal aberto).
- [x] Odontograma acessível por teclado e com arcadas FDI completas (faltam 13-15, 17, 18…).
- [x] CSV: neutralizar células que começam com `= + - @`.
- [x] Código morto: mocks de `data.ts`, `Placeholder.tsx`, `public/logo.png` (224 KB no cache do SW),
      `.doc-grid2/3`, CSS de sidebar ≤ 1024 px; README ainda "Sorriso Miúdo";
      `crm-odontopedi-trico-web/` versionado (2,6 MB).
- [x] Régua do CRM: a tela promete "Dispara 48h antes" e nada dispara → deixar explícito que é
      manual até a decisão sobre a WhatsApp Cloud API.

## Fase 6 — Pedido "vamos fazer tudo" (15/10/2026)

O que faltava para o consultório odontológico e para automatizar, já no código:

- [x] **Prontuário**: evolução e atendimento não se apagam (anular com motivo, riscado e visível);
      histórico de alterações por registro (`audit_log`); anexos privados (radiografias, exames) no
      bucket `patient-files`.
- [x] **Documentos**: receituário (simples e controle especial), atestado e declaração de
      comparecimento, com data de hoje, dados e assinatura vindos de Configurações.
- [x] **Odontograma** por face (M, D, O/I, V, L/P) em decídua, mista e permanente completas, com
      impressão das faces; índices pediátricos (risco de cárie, placa, flúor, selantes).
- [x] **Harmonização**: aplicações com produto, lote e validade; sessões de fotos gravadas.
- [x] **Automação** (Edge Functions + pg_cron): confirmação com resposta "1"/"2" que muda a Agenda,
      cobrança D-3/D0/D+3 com PIX, retorno, retoque, aniversário, pós-atendimento e alerta de
      estoque pelo WhatsApp oficial; cobrança Asaas (PIX/boleto) com baixa automática.
- [x] **Agendamento online** em `/agendar` com horários livres; a clínica aceita ou recusa.
- [x] **Receita Saúde**: texto pronto do recibo e marcação de lançado.
- [x] **Acesso**: criar conta, esqueci a senha, nova senha pelo link e "acesso pendente" para quem
      não está na equipe (migração 0027).
- [x] **Configurações** no modelo Aura+ enviado em 15/10: abas em pílula, cartões "Meus dados",
      "Quadro da clínica", "Dados cadastrais" e "Recebimentos"; nome e especialidade de quem
      assina vão para os documentos.
- [x] Pacote principal de 924 KB → 141 KB: telas por rota (`React.lazy`, recarrega uma vez se um deploy
      apagar o pacote antigo) e React/Supabase em pacotes próprios que ficam no cache entre versões.
