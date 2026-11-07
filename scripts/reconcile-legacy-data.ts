import { Client } from "pg";

const sourceUrl = process.env.LEGACY_DATABASE_URL;
const targetUrl = process.env.BILLING_DATABASE_URL;
if (!sourceUrl || !targetUrl) throw new Error("LEGACY_DATABASE_URL and BILLING_DATABASE_URL are required");
const source = new Client({ connectionString: sourceUrl });
const target = new Client({ connectionString: targetUrl });
async function main(): Promise<void> {
 await Promise.all([source.connect(), target.connect()]);
 try {
  const sourceCounts = await source.query(`SELECT
    (SELECT count(*)::int FROM "Orcamento") budgets,
    (SELECT count(*)::int FROM "OrcamentoServico") services,
    (SELECT count(*)::int FROM "OrcamentoPeca") parts`);
  const targetCounts = await target.query(`SELECT
    (SELECT count(*)::int FROM "Budget") budgets,
    (SELECT count(*)::int FROM "BudgetService") services,
    (SELECT count(*)::int FROM "BudgetPart") parts,
    (SELECT count(*)::int FROM "BudgetService" x LEFT JOIN "Budget" b ON b.id=x."budgetId" WHERE b.id IS NULL) orphan_services,
    (SELECT count(*)::int FROM "BudgetPart" x LEFT JOIN "Budget" b ON b.id=x."budgetId" WHERE b.id IS NULL) orphan_parts`);
  const expected = sourceCounts.rows[0];
  const actual = targetCounts.rows[0];
  const ok = expected.budgets === actual.budgets && expected.services === actual.services && expected.parts === actual.parts && actual.orphan_services === 0 && actual.orphan_parts === 0;
  console.log(JSON.stringify({ ok, expected, actual }, null, 2));
  if (!ok) process.exitCode = 2;
 } finally {
  await Promise.all([source.end(), target.end()]);
 }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
