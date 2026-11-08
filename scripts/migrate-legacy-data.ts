import { Client } from "pg";
import { assertMoney, mapLegacyBudgetStatus } from "../src/data/legacy-mapping.js";

const sourceUrl = process.env.LEGACY_DATABASE_URL;
const targetUrl = process.env.BILLING_DATABASE_URL;
if (!sourceUrl || !targetUrl) throw new Error("LEGACY_DATABASE_URL and BILLING_DATABASE_URL are required");

const source = new Client({ connectionString: sourceUrl });
const target = new Client({ connectionString: targetUrl });

async function main(): Promise<void> {
 await Promise.all([source.connect(), target.connect()]);
 try {
  const budgets = await source.query(`
    SELECT o.id, o."ordemServicoId", os."numeroOs", o."valorTotal", o.status,
           o."criadoEm", o."atualizadoEm"
      FROM "Orcamento" o JOIN "OrdemDeServico" os ON os.id = o."ordemServicoId"
     ORDER BY o."criadoEm", o.id
  `);
  await target.query("BEGIN");
  for (const row of budgets.rows) {
    await target.query(
      `INSERT INTO "Budget" (id, "externalOrderId", "externalOrderNumber", status, "totalAmount", version, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4::"BudgetStatus",$5,0,$6,$7)
       ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, "totalAmount"=EXCLUDED."totalAmount", "updatedAt"=EXCLUDED."updatedAt"`,
      [row.id, row.ordemServicoId, row.numeroOs, mapLegacyBudgetStatus(row.status), assertMoney(row.valorTotal), row.criadoEm, row.atualizadoEm]
    );
  }

  const services = await source.query(`SELECT os.id, os."orcamentoId", os."servicoId", s.nome, os.valor FROM "OrcamentoServico" os JOIN "Servico" s ON s.id=os."servicoId"`);
  for (const row of services.rows) {
    await target.query(
      `INSERT INTO "BudgetService" (id, "budgetId", "externalItemId", description, "unitPrice", quantity)
       VALUES ($1,$2,$3,$4,$5,1) ON CONFLICT ("budgetId", "externalItemId")
       DO UPDATE SET description=EXCLUDED.description, "unitPrice"=EXCLUDED."unitPrice"`,
      [row.id, row.orcamentoId, row.servicoId, row.nome, assertMoney(row.valor)]
    );
  }
  const parts = await source.query(`SELECT op.id, op."orcamentoId", op."pecaId", p.nome, op."valorUnitario", op.quantidade FROM "OrcamentoPeca" op JOIN "Peca" p ON p.id=op."pecaId"`);
  for (const row of parts.rows) {
    await target.query(
      `INSERT INTO "BudgetPart" (id, "budgetId", "externalItemId", description, "unitPrice", quantity)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT ("budgetId", "externalItemId")
       DO UPDATE SET description=EXCLUDED.description, "unitPrice"=EXCLUDED."unitPrice", quantity=EXCLUDED.quantity`,
      [row.id, row.orcamentoId, row.pecaId, row.nome, assertMoney(row.valorUnitario), row.quantidade]
    );
  }
  await target.query("COMMIT");
  console.log(JSON.stringify({ migratedBudgets: budgets.rowCount }));
 } catch (error) {
  await target.query("ROLLBACK");
  throw error;
 } finally {
  await Promise.all([source.end(), target.end()]);
 }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
