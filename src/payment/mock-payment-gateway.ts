import { CreatePaymentInput, PaymentGateway, PaymentResult } from "./payment-gateway.js";
export class MockPaymentGateway implements PaymentGateway {
  private readonly payments = new Map<string, PaymentResult>();
  async create(input: CreatePaymentInput): Promise<PaymentResult> {
    const existing = this.payments.get(input.idempotencyKey); if (existing) return existing;
    const result = { id: `mock-${input.externalReference}`, status: "pending" as const, qrCode: `000201-MOCK-${input.externalReference}` };
    this.payments.set(input.idempotencyKey, result); return result;
  }
  async get(paymentId: string): Promise<PaymentResult> { return [...this.payments.values()].find((item) => item.id === paymentId) ?? { id: paymentId, status: "pending" }; }
  setStatus(paymentId: string, status: "approved" | "rejected"): void {
    const current = [...this.payments.entries()].find(([, item]) => item.id === paymentId);
    const result: PaymentResult = { ...(current?.[1] ?? { id: paymentId }), status };
    this.payments.set(current?.[0] ?? `simulation:${paymentId}`, result);
  }
  async cancel(paymentId: string): Promise<PaymentResult> { return { id: paymentId, status: "cancelled" }; }
  async refund(paymentId: string, _idempotencyKey: string): Promise<PaymentResult> { return { id: paymentId, status: "refunded" }; }
}
