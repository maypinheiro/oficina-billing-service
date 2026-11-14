# Decisões arquiteturais do Billing Service

Este documento registra as decisões permanentes do serviço. As decisões globais
da solução estão na [RFC de divisão dos microsserviços](https://github.com/maypinheiro/oficina-api/blob/main/docs/fase4/rfc-006-divisao-microservicos.md),
na [RFC da Saga](https://github.com/maypinheiro/oficina-api/blob/main/docs/fase4/rfc-007-saga-orquestrada.md)
e nos [ADRs da Fase 4](https://github.com/maypinheiro/oficina-api/tree/main/docs/fase4/adrs).

## BIL-ADR-001 — PostgreSQL exclusivo

- **Estado:** aceita.
- **Decisão:** usar PostgreSQL próprio para orçamento, itens, pagamento, inbox e
  outbox.
- **Motivo:** valores, relações e mudanças de estado exigem transações locais,
  constraints e auditoria relacional.
- **Alternativas:** compartilhar o banco do OS foi rejeitado por violar autonomia;
  DynamoDB foi rejeitado neste domínio por aumentar a complexidade das relações.
- **Consequência:** migrations e disponibilidade do banco pertencem ao Billing.

## BIL-ADR-002 — Transactional Outbox e Inbox

- **Estado:** aceita.
- **Decisão:** gravar mudança de negócio e outbox na mesma transação Prisma e
  deduplicar comandos em inbox persistida.
- **Motivo:** SNS/SQS oferece entrega pelo menos uma vez; publicação direta após
  commit criaria uma janela de perda.
- **Consequência:** eventos podem repetir, mas efeitos de negócio não; existe um
  publicador e política de reprocessamento operacional.

## BIL-ADR-003 — Porta PaymentGateway

- **Estado:** aceita.
- **Decisão:** isolar Mercado Pago atrás de `PaymentGateway`, com adapter real e
  mock acadêmico compatível.
- **Motivo:** testes não devem fazer cobrança real e o domínio não deve depender
  do SDK/contrato externo.
- **Consequência:** HML pode demonstrar o fluxo completo com mock; Sandbox real
  exige secrets, exposição HTTPS do webhook e configuração no provedor.

## BIL-ADR-004 — Webhook assinado e idempotente

- **Estado:** aceita.
- **Decisão:** validar `x-signature`, `x-request-id` e `data.id`, consultar o
  pagamento no adapter e persistir o resultado por chave idempotente.
- **Motivo:** webhooks podem ser falsificados, repetidos ou entregues fora de
  ordem.
- **Consequência:** requisição inválida recebe 401; repetição válida não publica
  um segundo efeito.

## BIL-ADR-005 — REST somente na borda

- **Estado:** aceita.
- **Decisão:** usar REST para decisão humana, webhook e health; usar SQS/SNS no
  caminho transacional da Saga.
- **Motivo:** desacoplar disponibilidade e tempo de execução dos serviços.
- **Consequência:** o estado converge por eventos e a consulta global pertence ao
  OS Service.

## BIL-ADR-006 — Deploy independente no EKS

- **Estado:** aceita.
- **Decisão:** namespace, imagem, manifests, HPA, PDB, infraestrutura e pipeline
  independentes, compartilhando apenas o cluster EKS.
- **Motivo:** atender autonomia de deploy sem multiplicar clusters e custo no
  Learner Lab.
- **Consequência:** falha/escala do Billing não exige release dos outros serviços;
  a plataforma EKS continua um recurso compartilhado documentado.

## BIL-ADR-007 — Compatibilidade AWS Academy

- **Estado:** aceita com dívida técnica explícita.
- **Decisão:** injetar credenciais STS temporárias pelo GitHub Environment no pod
  enquanto IRSA/Pod Identity estiver indisponível.
- **Motivo:** limitação da conta acadêmica.
- **Consequência:** a sessão expira e requer novo CD; em conta permanente deve ser
  substituída por identidade de workload com policy mínima.
