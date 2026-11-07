# Contratos planejados

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

Todos os envelopes deverão conter `messageId`, `correlationId`, `sagaId`, `causationId`, versão e data de ocorrência. O schema detalhado será versionado antes da integração.
