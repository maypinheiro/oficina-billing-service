# Contratos de mensageria v1

## Comandos consumidos

- `billing.budget.requested.v1`
- `billing.payment.verify.requested.v1`
- `billing.budget.cancel.requested.v1` (compensação)

## Eventos publicados

- `billing.budget.created.v1`
- `billing.budget.approved.v1`
- `billing.budget.rejected.v1`
- `billing.payment.confirmed.v1`
- `billing.operation.failed.v1`

O contrato está em `src/messaging/message-envelope.ts`. Ele exige identificação, tipo, natureza, versão, data, origem, agregado, correlação e payload. `sagaId` e `causationId` preservam a cadeia causal. A fila recebe comandos e eventos SNS, possui DLQ e idempotência persistida no PostgreSQL.
