# Migração e isolamento dos dados

O Billing usa exclusivamente `BILLING_DATABASE_URL`. `LEGACY_DATABASE_URL` é aceito somente pelos scripts temporários de migração e deve possuir acesso somente de leitura.

```bash
npm run db:generate
npm run db:migrate
npm run data:migrate
npm run data:reconcile
```

O migrador preserva IDs de orçamento e itens, converte status e usa upsert. A reconciliação compara orçamento, serviços e peças e verifica órfãos. A migração não cria pagamentos inexistentes no legado.

Após o cutover, revogar a credencial legada. O usuário de runtime do Billing recebe acesso apenas ao database `oficina_billing`; não pode conectar ao database do OS.
