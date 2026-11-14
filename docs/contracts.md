# Contratos de mensageria v1

## Envelope comum

O contrato versionado está em `src/messaging/message-envelope.ts` e exige
`messageId`, `messageType`, `messageKind`, `schemaVersion`, `occurredAt`,
`source`, `aggregateId`, `correlationId` e `payload`. `sagaId` identifica a Saga
e `causationId` preserva a cadeia que originou a mensagem.

CPF, JWT, secrets e dados sensíveis de pagamento não pertencem ao envelope.

## Comandos consumidos

| `messageType` | Efeito local | Evento de sucesso |
|---|---|---|
| `CreateQuote` | cria orçamento idempotente para a OS | `QuoteCreated` |
| `CancelQuote` | cancela orçamento pendente/rejeitado | `QuoteCancelled` |
| `CancelQuoteApproval` | desfaz aprovação durante compensação | `QuoteApprovalCancelled` |
| `RequestPayment` | cria cobrança com chave idempotente | `PaymentCreated` |
| `CancelPayment` | cancela cobrança ainda não confirmada | `PaymentCancelled` |
| `RefundPayment` | registra/solicita estorno permitido | `PaymentRefunded` |

Os seis comandos são suportados pelo participante Billing. A máquina atual do
orquestrador usa `CreateQuote`, `CancelQuoteApproval` e `RequestPayment` no fluxo
demonstrado; `CancelPayment` e `RefundPayment` são contratos compensatórios
disponíveis para evolução do fluxo pós-cobrança.

## Eventos publicados fora do handler de comandos

| Evento | Origem | Significado |
|---|---|---|
| `QuoteApproved` | decisão REST do cliente | orçamento aprovado; Saga pode iniciar execução |
| `QuoteRejected` | decisão REST do cliente | orçamento rejeitado; Saga inicia cancelamento |
| `PaymentConfirmed` | webhook ou simulação HML | pagamento confirmado de forma idempotente |
| `PaymentFailed` | webhook ou simulação HML | pagamento recusado/falhou definitivamente |

Decisão e resultado do pagamento são persistidos com uma mensagem Outbox na
mesma transação. O publicador envia a mensagem ao SNS posteriormente.

## Transporte, retry e DLQ

- comandos chegam à fila `oficina-billing-{env}-commands`;
- eventos são publicados no tópico de eventos de domínio e entregues à fila do OS;
- a fila possui redrive para `oficina-billing-{env}-dlq` após cinco recebimentos;
- falha transitória lança erro e mantém a mensagem para retry;
- o consumidor só remove a mensagem após concluir o processamento;
- a DLQ preserva mensagens que exigem diagnóstico/replay operacional.

## Idempotência e ordem

`InboxMessage.messageId` impede um segundo efeito para a mesma mensagem. O
`payloadHash` detecta reuso indevido do identificador com outro conteúdo.
Pagamentos também usam `idempotencyKey` única no banco e no provedor. Não existe
garantia de ordem global: cada handler valida o estado atual antes de transicionar.

## Evolução de versão

- campos novos e opcionais permanecem na versão 1;
- remoção, renomeação ou mudança semântica exige nova `schemaVersion`;
- consumidores ignoram campos desconhecidos;
- um nome de mensagem nunca é reutilizado com outro significado;
- testes unitários do envelope e dos handlers bloqueiam contrato inválido.

O catálogo integrado de todos os participantes está em
<https://github.com/maypinheiro/oficina-api/blob/main/docs/fase4/catalogo-mensagens.md>.
