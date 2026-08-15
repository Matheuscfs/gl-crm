# Sorriso Miúdo — CRM Odontopediátrico

Implementation of the *CRM Odontopediátrico* design (from the Claude Design handoff bundle
`crm-odontopedi-trico-web/`) as a real React + TypeScript + Vite app.

## Running

```bash
npm install
npm run dev      # dev server (Vite)
npm run build    # typecheck + production build
npm run preview  # preview the production build
```

## What's implemented

All 12 design frames became live, routed screens:

| Route | Screen |
| --- | --- |
| `/` | **Dashboard** — cards, agenda do dia, aniversariantes, retornos vencidos |
| `/agenda` | **Agenda** — grade semanal com eventos posicionados por horário, legenda de status, seletor diária/semanal/mensal |
| `/pacientes` | **Lista de pacientes** — busca por criança/responsável + filtro de retorno vencido (funcionais) |
| `/pacientes/:id/odontograma` | **Ficha · Odontograma** decíduo/misto, dente selecionável, gráfico de condições |
| `/pacientes/:id/anamnese` | **Ficha · Anamnese** — hábitos, gestação, saúde geral, alimentação |
| `/pacientes/:id/historico` | **Ficha · Histórico** — timeline com escala Frankl |
| `/pacientes/:id/planos` | **Plano de tratamento / Orçamento** — tabela, totais, aprovação, parcelamento |
| `/crm` | **CRM** — funil de leads, régua de comunicação (toggles funcionais), preview WhatsApp |
| `/financeiro` | **Financeiro** — cards, contas a receber, faturamento, formas de pagamento |
| `/estoque` | **Estoque** — itens, ficha técnica (BOM) por procedimento, movimentações |
| `/configuracoes` | **Configurações** — procedimentos e preços, horários, perfil da clínica |

The prototype's "Estados" frame (empty / loading / error) is reproduced as reusable
patterns (`.skeleton` in `styles.css`, empty-state cards) rather than a standalone screen.

## Structure

- `src/data.ts` — typed mock-data layer mirroring the design's `renderVals()`.
- `src/icons.tsx` — the inline SVG icon set from the prototype.
- `src/components/` — `Layout` (sidebar + shell), `Tooth`, shared `ui` primitives.
- `src/pages/` — one file per screen; `pages/patient/` holds the Ficha tabs.

Design tokens (colors, fonts, radii) live as CSS variables in `src/styles.css`, matching
the prototype's teal palette, Plus Jakarta Sans, and JetBrains Mono.
