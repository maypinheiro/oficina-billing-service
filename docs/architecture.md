# Arquitetura e limites

O Billing Service será o único proprietário de orçamentos, itens de orçamento, aprovações, pagamentos e idempotência dos webhooks do provedor. Seu banco relacional será PostgreSQL próprio.

Receberá comandos assíncronos do OS Service, integrará com o Mercado Pago por uma porta de aplicação e publicará eventos de resultado. Nenhuma tabela será compartilhada. Falhas serão encaminhadas à DLQ e as operações externas usarão chave de idempotência.

Na Saga orquestrada, Billing participa e responde; o estado global e a decisão da próxima etapa continuam no OS Service.
