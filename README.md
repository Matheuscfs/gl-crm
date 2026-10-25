# GL CRM — Consultório Dra. Gabriela Lorenzi

CRM odontológico (odontopediatria, adulto e harmonização) em React + TypeScript + Vite, com Supabase
(banco, login, arquivos e funções) e publicação na Vercel. Funciona no computador, no tablet da
recepção e no celular (PWA instalável).

## O que tem

| Área | Destaques |
|---|---|
| **Início / Resumo** | pendências do dia, fila, quem chamar (retorno vencido, parcela, retoque, aniversário), pedidos de remarcação pelo WhatsApp |
| **Agenda** | semana / dia / mês, arrastar para remarcar, conflitos, expediente, concluir (cobra e baixa estoque uma vez só), desmarcar sem apagar, pedidos online, sincroniza com o Google Agenda |
| **Ficha do paciente** | anamnese, odontograma 2D/3D por face (decídua, mista e permanente completas), atendimentos e evoluções com anulação e histórico de alterações, planos e orçamentos, financeiro, documentos e anexos privados (radiografias), antes/depois, mapa facial com produto/lote/validade, prevenção (risco de cárie, placa, flúor, selantes) |
| **Documentos** | prontuário, TCLE, uso de imagem, autorização de menor, **receituário** (simples e controle especial), **atestado**, **declaração de comparecimento** — com data de hoje e dados da clínica |
| **Financeiro** | contas a receber, PIX copia e cola, cobrança Asaas (PIX/boleto com baixa automática), recibos, **Receita Saúde** e CSV do Carnê-Leão |
| **Estoque** | inventário, mínimo, validade, lote, movimentações gravadas, ficha técnica por procedimento |
| **Relacionamento** | funil de leads, CRC, régua de mensagens |
| **Automação** | confirmação 24 h antes (resposta "1" confirma na Agenda), cobrança D-3/D0/D+3, retorno, retoque, aniversário, pós-atendimento, alerta de estoque — WhatsApp oficial (Meta) |
| **Agendamento online** | página pública `/agendar` com horários livres; a clínica aceita ou recusa |
| **Acesso** | login, criar conta, esqueci a senha; só e-mails da equipe veem dados (RLS) |

## Rodar

```bash
npm install
npm run dev      # sem .env abre em modo demonstração (dados fictícios)
npm test         # regras de dinheiro e da automação
npm run build    # typecheck + build de produção
```

Variáveis em `.env` (veja `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_DEMO_DATA=0` e, opcionalmente, as do Google.

## Banco (Supabase)

Aplique as migrações de `supabase/migrations/` em ordem no SQL Editor (sem `0002_seed` e
`0008_seed_estetico`, que são dados fictícios). A **0026** traz prontuário com rastro, odontograma por
face, anexos, aplicações com lote, índices, automação e agendamento online; a **0027** fecha o acesso à
equipe cadastrada (a primeira pessoa que entrar depois dela vira administradora); a **0028** fecha os
dois avisos do Security Advisor (funções de gatilho).

## Automação

Edge Functions em `supabase/functions/` — guia completo (Meta, Asaas, segredos, deploy e agendamento)
em [`supabase/functions/README.md`](supabase/functions/README.md).

## Estrutura

- `src/store.tsx` — estado do app e gravação no banco (só confirma depois da resposta; desfaz se falhar).
- `src/lib/` — sync com o Supabase, dinheiro, datas, PIX, recibos, automação, Google.
- `src/pages/` — uma tela por arquivo; `pages/patient/` são as abas da ficha.
- `src/styles.css` — tokens (claro e escuro) e estilos.
- `docs/plano-implementacao.md` — checklist do que foi feito e do que falta.
