# Arquitetura e limites

O Billing Service é o único proprietário de orçamentos, itens de orçamento, aprovações, pagamentos e idempotência dos webhooks do provedor. Seu banco relacional é um PostgreSQL próprio.

Recebe comandos assíncronos do OS Service, integra com o Mercado Pago por uma porta de aplicação e publica eventos de resultado. Nenhuma tabela é compartilhada. Falhas esgotadas são encaminhadas à DLQ e as operações externas usam chave de idempotência.

Na Saga orquestrada, Billing participa e responde; o estado global e a decisão da próxima etapa continuam no OS Service.
