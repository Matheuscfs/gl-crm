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
- [ ] Criar no Supabase Auth o usuário da Dra. (Authentication → Users → Add user).
- [ ] Authentication → URL Configuration: Site URL `https://gl-crm-delta.vercel.app`.
- [ ] Rodar o Security Advisor no painel do projeto novo.

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

## Fase 1 — Front-end: fundação visual e responsiva  ← em andamento

- [x] **Tokens** em `styles.css`: `--primary*` (alias dos `--teal*`, que hoje guardam azul),
      `--brand-pink`, `--danger`/`--success` semânticos, `--text-2` com contraste AA
      (`--muted #8b93a7` dá ~3:1), `--focus-ring`, sombras e escala de z-index.
- [x] **Restos da paleta teal**: hover verde no botão primário, `.btn-teal-soft:hover` menta,
      cinzas esverdeados, sombras `rgba(15,40,45)`.
- [x] **Anel de foco visível** (hoje ~1,5:1, reprova WCAG 1.4.11).
- [x] **Fonte com fallback**: 362 `font: "… 'Plus Jakarta Sans'"` inline sem família genérica →
      texto em Times enquanto a fonte carrega ou offline. Trocar por `var(--font)`.
- [ ] **Grades responsivas**: classes `.grid-kpi`, `.split`, `.split-aside`, `.field-row` que
      colapsam; migrar as grades de layout inline. Feito: Dashboard, Financeiro, Dados, Anamnese,
      Odontograma, Planos, MapaFacial, AntesDepois e demais abas da ficha. Falta: Estoque, CRM,
      Configurações, FichaProcedimento, Relatórios (no celular as tabelas rolam de lado).
- [ ] **Shell**: "Sair" na folha "Mais" (hoje não há como sair no tablet/celular); folha fecha
      ao tocar na página atual e com Esc; menu lateral rola em telas baixas (1366×768 esconde
      Ajuda/Configurações/avatar); Esc fecha só a camada de cima (hoje fecha popup + modal).
- [ ] **Login**: Enter no modo "Esqueci minha senha" tenta logar.
- [x] **Textos**: Dashboard diz "Bom dia" a qualquer hora; no modo demo o Resumo diz
      "dados sincronizados com o Supabase" e fica preso em "conectando ao banco…".
- [ ] **A11y básica**: `aria-label` nos botões só-ícone (‹ › da Agenda, sino, avatar),
      toast com `aria-live` e acima do overlay de impressão, busca do iPhone com 16 px.

## Fase 2 — Front-end: parar de fingir (sem migração de banco)

**Ações que só mostram toast**
- [x] Dashboard "Contatar"/"Reavaliar" → `waLink` + `window.open` (como a Agenda); `div` → `button`.
- [x] FinanceiroPaciente "Enviar cobrança" → agora abre o WhatsApp com o lembrete da parcela.
- [x] Documentos "Baixar"/"Renomear"; Odontograma "Compartilhar"/"Exportar imagem"/"Filtrar" → removidos (só mostravam aviso).
- [ ] Salvamentos com `setTimeout` (Pacientes, Agenda, CRM, Anamnese, Estoque): toast só depois da resposta.

**Demonstração vazando para dados reais**
- [ ] `templates.tsx:32,105` mistura `DEMO_PED`/`DEMO_ADULT` na anamnese real do documento.
- [ ] `templates.tsx` nomes fictícios como padrão e consentimentos (TCLE, uso de imagem) já marcados.
- [x] `MapaFacial.tsx:21` começava com testa 10 / glabela 8 / pés de galinha 6+6 para todo paciente (agora só na demonstração).
- [ ] `data.ts:168` `isSeedPatient` ignora `DEMO_DATA` (homônimo do seed herda plano/anamnese demo).
- [ ] `Configuracoes.tsx:24-36` CNPJ/telefone/equipe fictícios podem ser gravados e sair no recibo.

**Datas**
- [ ] `DocKit.tsx:141` assinatura "17 de julho de 2026" em todo documento.
- [ ] `Estoque.tsx:24` data de entrada fixa `'17/08'`.
- [x] `Financeiro.tsx:117` recibo datado no vencimento, não no pagamento (agora sai com a data da emissão).
- [x] Parcelas de demonstração com vencimento fixo em jun/jul → relativas a hoje (o mês atual aparecia vazio).
- [x] `data.ts:194` `idadeLabel` com `new Date('AAAA-MM-DD')` (UTC → dia anterior no Brasil).
- [ ] `Estoque.tsx:27,428` validade: item que vence hoje aparece "vencido".
- [ ] `CRM.tsx:243` preview do WhatsApp fixo "amanhã, 19/07".

**Renomear e valores**
- [x] `Pacientes.tsx:127`: atualizava pelo nome novo → nada salvava (corrigido; agora também bloqueia nome duplicado).
- [ ] `Estoque.tsx:241`: mesmo bug ao renomear material.
- [ ] `Dados.tsx:41`: renomear quebra a rota (URL usa o nome).
- [ ] `money.ts:4` / `fmt.ts:8` `parseMoney`: "180.50" vira 18050 (teclado decimal do tablet); aceita negativo.

**Agenda**
- [x] Setas não andam na visão Diária; Mensal ancorada na segunda-feira da semana.
- [x] Data vazia aceita (vira 1900 e o agendamento some).
- [ ] Redimensionar grava no banco a cada `pointermove` (o fim da grade já usa `AGENDA_END` e respeita o expediente).
- [ ] "Cancelar consulta" apaga o registro em vez de marcar `desmarcado`.

**Regras que a tela mostra errado**
- [x] "Retorno vencido" depende do campo `late`, que nenhum código grava → nunca aparece.
      Derivar de `next` vs hoje; concluir atendimento deve atualizar `last`/`next`.
- [x] Idade congelada no texto do cadastro → calcular da data de nascimento (lista, filtro e exportação).
- [ ] Relatórios "Origem de leads" usa o texto livre do lead como origem ("19/07", "Plano #218").
- [x] "Atendimentos hoje" e visão Mensal contam desmarcados.

**Impressão**
- [ ] Odontograma "Imprimir" sai em branco (CSS de print esconde tudo fora de `.doc-sheet`).
- [ ] Recibo com cabeçalho e assinatura duplicados.
- [ ] Dados da clínica fixos no código (DocKit, Recibo, Evolução) → `useClinic()`.
- [ ] `@media print`: overlay estático para pacotes com várias folhas (confirmar com teste real).

**Confirmação e validação**
- [x] ConfirmDialog em: item do plano, lançamento, aprovar plano.
- [ ] ConfirmDialog em: atendimento, responsável, "Limpar marcadores", remover acesso, marcar pago.
- [x] Validar desconto do plano (0…subtotal).
- [ ] Validar: quantidades de estoque (> 0, ≤ saldo), unidades do mapa (> 0).

## Fase 3 — Store: carregamento, erros e identidade

- [ ] Expor `loading`/`error` no store; `ErrorState` com "Tentar de novo" (existe e não é usado);
      ficha do paciente sem "Paciente não encontrado" durante o F5.
- [ ] Erros do Supabase com toast + rollback (store, `useCollection`, Financeiro, CRM).
- [ ] Ids `tmp…`: bloquear escrita até o id real chegar (hoje perde edição em silêncio).
- [ ] **Identidade por `_id`**: rota `/pacientes/:id`, update/delete por id, `key` por id;
      `whats.ts` casa só primeiro nome → mensagem pode ir ao responsável errado (LGPD).
- [ ] Concluir atendimento: confirmação + idempotência (hoje cobra e baixa estoque de novo
      se o status voltar a "Concluído") e não cobrar procedimento já coberto por plano aprovado.
- [ ] Procedimento casado por `includes` no nome ("Consulta" cobra "1ª consulta / avaliação").
- [ ] `select('*')` sem paginação: limite de 1000 linhas → agenda por janela de datas.
- [ ] Performance: `value` do store recriado a cada render (re-render do app a cada `pointermove`).

## Fase 4 — Precisa de migração no banco

O MCP não alcança o projeto `qkgmlmlzahcsmxqwhgjr`: cada item vira um arquivo `0026+` em
`supabase/migrations/` para aplicar à mão no SQL Editor.

- [ ] `installments.pago_em` — faturamento pela data de pagamento e recibo na data certa.
- [ ] `appointments.patient_id`, `procedimento_id`, `gcal_id`, `cobrado_em`.
- [ ] Movimentações de estoque persistidas (hoje só em memória).
- [ ] `photo_sessions` (tabela já existe na 0004) ligada às fotos; `documents.storage_path` (upload real).
- [ ] `clinic_settings.cidade` (PIX usa o endereço cortado em 15 caracteres como cidade).

## Fase 5 — Consistência e limpeza

- [ ] Hex inline → tokens (804 cores; `#26324a` 102×, `#8b93a7` 83×), tela a tela.
- [ ] Unificar: `PrintDoc`/`DocumentViewer`; `StatCard`/`FinCard`/`Kpi`;
      `SuggestInput`/`PatientPicker`/`ProcPicker`; um helper de moeda, de data, meses e aniversário.
- [ ] Variante `danger` no Button; `ConfirmDialog` com `cancelLabel`; Modal com portal e
      devolução de foco; popovers (calendário) em portal para não cortar dentro do modal.
- [x] Notificações e busca global no Layout (hoje só no Dashboard desktop); "lido" com período.
- [ ] PWA: `registerType: 'prompt'` + toast "Nova versão" (hoje recarrega sozinho e perde modal aberto).
- [ ] Odontograma acessível por teclado e com arcadas FDI completas (faltam 13-15, 17, 18…).
- [ ] CSV: neutralizar células que começam com `= + - @`.
- [ ] Código morto: mocks de `data.ts`, `Placeholder.tsx`, `public/logo.png` (224 KB no cache do SW),
      `.doc-grid2/3`, CSS de sidebar ≤ 1024 px; README ainda "Sorriso Miúdo";
      `crm-odontopedi-trico-web/` versionado (2,6 MB).
- [ ] Régua do CRM: a tela promete "Dispara 48h antes" e nada dispara → deixar explícito que é
      manual até a decisão sobre a WhatsApp Cloud API.
