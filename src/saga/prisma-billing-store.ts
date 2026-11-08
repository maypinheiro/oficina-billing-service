import { PrismaClient } from "@prisma/client";
import { BillingStore } from "./billing-command-handler.js";

type QuotePayload = { orderNumber?: string; totalAmount?: number };

export class PrismaBillingStore implements BillingStore {
  constructor(private readonly prisma: PrismaClient) {}
  async createQuote(orderId: string, raw: unknown): Promise<{ quoteId: string }> {
    const payload = raw as QuotePayload;
    const quote = await this.prisma.budget.upsert({
      where: { externalOrderId: orderId },
      create: { externalOrderId: orderId, externalOrderNumber: payload.orderNumber ?? orderId, totalAmount: payload.totalAmount ?? 0 },
      update: {},
    });
    return { quoteId: quote.id };
  }
  async cancelQuote(orderId: string): Promise<void> { await this.setBudgetStatus(orderId, "CANCELLED"); }
  async cancelQuoteApproval(orderId: string): Promise<void> { await this.setBudgetStatus(orderId, "CANCELLED"); }
  async requestPayment(orderId: string): Promise<{ paymentId: string }> {
    const budget = await this.prisma.budget.findUniqueOrThrow({ where: { externalOrderId: orderId } });
    const payment = await this.prisma.payment.upsert({ where: { idempotencyKey: `payment:${orderId}` }, create: { budgetId: budget.id, idempotencyKey: `payment:${orderId}`, provider: "mercado-pago", amount: budget.totalAmount }, update: {} });
    return { paymentId: payment.id };
  }
  async cancelPayment(orderId: string): Promise<void> { await this.setPaymentStatus(orderId, "CANCELLED"); }
  async refundPayment(orderId: string): Promise<void> { await this.setPaymentStatus(orderId, "REFUNDED"); }
  private async setBudgetStatus(orderId: string, status: "CANCELLED"): Promise<void> { await this.prisma.budget.update({ where: { externalOrderId: orderId }, data: { status, version: { increment: 1 } } }); }
  private async setPaymentStatus(orderId: string, status: "CANCELLED" | "REFUNDED"): Promise<void> {
    const budget = await this.prisma.budget.findUniqueOrThrow({ where: { externalOrderId: orderId } });
    await this.prisma.payment.updateMany({ where: { budgetId: budget.id, status: { not: status } }, data: { status } });
  }
}
