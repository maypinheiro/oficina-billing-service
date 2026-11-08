export type LegacyBudgetStatus = "PENDENTE" | "APROVADO" | "REJEITADO";
export type BudgetStatus = "PENDING" | "APPROVED" | "REJECTED";

const statusMap: Record<LegacyBudgetStatus, BudgetStatus> = {
  PENDENTE: "PENDING",
  APROVADO: "APPROVED",
  REJEITADO: "REJECTED"
};

export function mapLegacyBudgetStatus(status: string): BudgetStatus {
  const mapped = statusMap[status as LegacyBudgetStatus];
  if (!mapped) throw new Error(`Unsupported legacy budget status: ${status}`);
  return mapped;
}

export function assertMoney(value: unknown): string {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) throw new Error("Invalid monetary value");
  return normalized.toFixed(2);
}
