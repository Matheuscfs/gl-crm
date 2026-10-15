# Automação do GL CRM (WhatsApp, cobrança e lembretes)

Quatro Edge Functions do Supabase. O app funciona sem elas (envio manual pelo WhatsApp); com elas ligadas, as mensagens saem sozinhas.

| Função | O que faz | Quem chama |
|---|---|---|
| `automacao` | A cada 15 min decide e envia: confirmação 24 h antes, cobrança D-3 / D0 / D+3 com PIX, lembrete de retorno, retoque estético, aniversário, pós-atendimento e alerta de estoque para a clínica. Só entre 8h e 20h, sem repetir. | pg_cron (`supabase/automacao/agendar_cron.sql`) |
| `whatsapp-webhook` | Recebe status (entregue/lida) e respostas. **"1" / "Confirmar" confirma o agendamento na Agenda**; "2" / "Remarcar" aparece no app para a recepção ligar. | Meta (webhook do app) |
| `cobranca-psp` | Gera a cobrança da parcela no **Asaas** (PIX, boleto ou cartão) e devolve o link. | Botão "Gerar cobrança" no Financeiro |
| `asaas-webhook` | Quando o Asaas confirma o pagamento: parcela vira **paga** com a data certa e o **recibo é gerado**. | Asaas |

As regras ficam em `_shared/regras.ts` e têm testes (`npm test` na raiz).

## 1. WhatsApp Cloud API (Meta)

1. Em [business.facebook.com](https://business.facebook.com), verifique a empresa e crie um **app** do tipo *Business* em developers.facebook.com → adicione o produto **WhatsApp**.
2. Cadastre o **número da clínica** (não pode estar em uso no WhatsApp comum do celular — use um número só para o sistema, ou migre o atual).
3. Gere um **token permanente** (Usuário do sistema → Gerar token com `whatsapp_business_messaging`).
4. Em *Gerenciador do WhatsApp → Modelos de mensagem*, crie os modelos abaixo (categoria **Utilidade**, idioma **Português (BR)**). Os nomes precisam ser exatamente estes:

| Modelo | Corpo (as variáveis `{{n}}` são preenchidas pelo sistema) |
|---|---|
| `confirmacao_consulta` | Olá, {{1}}! Lembrando {{2}} com a {{3}} {{4}} às {{5}}. Você confirma? Responda *1* para confirmar ou *2* para remarcar. (adicione os botões de resposta rápida **Confirmar** e **Remarcar**) |
| `lembrete_parcela` | Olá, {{1}}! A parcela de {{2}} referente a {{3}} {{4}}. {{5}} |
| `lembrete_retorno` | Olá, {{1}}! Está na hora do retorno {{2}} com a {{3}}. Responda esta mensagem para escolher o melhor horário. |
| `lembrete_retoque` | Olá, {{1}}! Já faz {{2}} meses do seu último procedimento com a {{3}}. Quer agendar a reavaliação? |
| `aniversario` | Feliz aniversário, {{1}}! 🎉 A {{2}} e toda a equipe desejam um dia muito especial. (categoria *Marketing*) |
| `pos_atendimento` | Olá, {{1}}! Como {{2}} está depois do atendimento de hoje? {{3}} |
| `alerta_estoque` | Estoque da clínica — {{1}} |

5. Webhook: em *WhatsApp → Configuração*, URL de callback `https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook`, token de verificação = o mesmo de `WHATSAPP_VERIFY_TOKEN`, e assine o campo **messages**.

> A Meta cobra por conversa iniciada pela empresa (Utilidade é mais barata que Marketing). Consulte a tabela de preços vigente para o Brasil.

## 2. Asaas (opcional — cobrança com baixa automática)

1. Crie a conta em [asaas.com](https://www.asaas.com) (pode testar no sandbox antes).
2. Copie a **chave de API** (Integrações → Chave de API).
3. Webhook de cobranças: URL `https://<PROJECT_REF>.supabase.co/functions/v1/asaas-webhook`, com um **token de autenticação** que você inventa (o mesmo de `ASAAS_WEBHOOK_TOKEN`).

## 3. Segredos e publicação

Supabase → **Edge Functions → Secrets** (ou `supabase secrets set NOME=valor`):

| Segredo | Valor |
|---|---|
| `CRON_SECRET` | uma senha longa qualquer (a mesma vai no `agendar_cron.sql`) |
| `WHATSAPP_TOKEN` | token permanente da Meta |
| `WHATSAPP_PHONE_ID` | *Phone number ID* do número |
| `WHATSAPP_VERIFY_TOKEN` | texto que você escolhe para validar o webhook |
| `WHATSAPP_APP_SECRET` | *App secret* (Configurações básicas do app) — confere a assinatura das chamadas |
| `ASAAS_API_KEY` | chave do Asaas (opcional) |
| `ASAAS_BASE` | `https://api-sandbox.asaas.com/v3` para testar; omita em produção |
| `ASAAS_WEBHOOK_TOKEN` | token do webhook do Asaas (opcional) |
| `LINK_AVALIACAO` | link do Google para avaliações (opcional, vai na mensagem pós-atendimento) |
| `NOME_DENTISTA` | padrão "Dra. Gabriela Lorenzi" |

Publicar (com a [Supabase CLI](https://supabase.com/docs/guides/cli), na raiz do projeto):

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase functions deploy automacao --no-verify-jwt
npx supabase functions deploy whatsapp-webhook --no-verify-jwt
npx supabase functions deploy asaas-webhook --no-verify-jwt
npx supabase functions deploy cobranca-psp
```

Depois rode `supabase/automacao/agendar_cron.sql` no SQL Editor e ligue **Configurações → Automação → WhatsApp automático** no app.

Para ver o que sairia sem enviar nada: `POST /functions/v1/automacao?simular=1` com o cabeçalho `x-cron-secret`.
