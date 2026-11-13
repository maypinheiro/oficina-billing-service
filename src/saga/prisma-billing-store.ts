import { PrismaClient } from "@prisma/client";
import { BillingStore, SagaContext } from "./billing-command-handler.js";
import { PaymentGateway } from "../payment/payment-gateway.js";

type QuotePayload = { orderNumber?: string; totalAmount?: number };

export class PrismaBillingStore implements BillingStore {
  constructor(private readonly prisma: PrismaClient, private readonly payments: PaymentGateway, private readonly payerEmail: string) {}
  async createQuote(orderId: string, raw: unknown, context: SagaContext): Promise<{ quoteId: string }> {
    const payload = raw as QuotePayload;
    const quote = await this.prisma.budget.upsert({
      where: { externalOrderId: orderId },
      create: {
        externalOrderId: orderId,
        externalOrderNumber: payload.orderNumber ?? orderId,
        totalAmount: payload.totalAmount ?? 0,
        sagaId: context.sagaId,
        correlationId: context.correlationId,
      },
      update: { sagaId: context.sagaId, correlationId: context.correlationId },
    });
    return { quoteId: quote.id };
  }
  async cancelQuote(orderId: string): Promise<void> { await this.setBudgetStatus(orderId, "CANCELLED"); }
  async cancelQuoteApproval(orderId: string): Promise<void> { await this.setBudgetStatus(orderId, "CANCELLED"); }
  async requestPayment(orderId: string): Promise<{ paymentId: string; status: string; qrCode?: string }> {
    const budget = await this.prisma.budget.findUniqueOrThrow({ where: { externalOrderId: orderId } });
    const idempotencyKey = `payment:${orderId}`;
    const provider = await this.payments.create({ amount: Number(budget.totalAmount), description: `Ordem de servico ${budget.externalOrderNumber}`, externalReference: orderId, idempotencyKey, payerEmail: this.payerEmail });
    const payment = await this.prisma.payment.upsert({ where: { idempotencyKey }, create: { budgetId: budget.id, idempotencyKey, externalPaymentId: provider.id, provider: "mercado-pago", amount: budget.totalAmount, status: provider.status === "approved" ? "CONFIRMED" : "PENDING" }, update: { externalPaymentId: provider.id } });
    return { paymentId: payment.id, status: provider.status, qrCode: provider.qrCode };
  }
  async cancelPayment(orderId: string): Promise<void> { const payment = await this.findPayment(orderId); if (payment.externalPaymentId) await this.payments.cancel(payment.externalPaymentId); await this.setPaymentStatus(orderId, "CANCELLED"); }
  async refundPayment(orderId: string): Promise<void> { const payment = await this.findPayment(orderId); if (payment.externalPaymentId) await this.payments.refund(payment.externalPaymentId, `refund:${orderId}`); await this.setPaymentStatus(orderId, "REFUNDED"); }
  private async setBudgetStatus(orderId: string, status: "CANCELLED"): Promise<void> { await this.prisma.budget.update({ where: { externalOrderId: orderId }, data: { status, version: { increment: 1 } } }); }
  private async setPaymentStatus(orderId: string, status: "CANCELLED" | "REFUNDED"): Promise<void> {
    const budget = await this.prisma.budget.findUniqueOrThrow({ where: { externalOrderId: orderId } });
    await this.prisma.payment.updateMany({ where: { budgetId: budget.id, status: { not: status } }, data: { status } });
  }
  private async findPayment(orderId: string) { const budget = await this.prisma.budget.findUniqueOrThrow({ where: { externalOrderId: orderId } }); return this.prisma.payment.findFirstOrThrow({ where: { budgetId: budget.id } }); }
}
