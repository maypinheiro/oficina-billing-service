import { Prisma, PrismaClient } from "@prisma/client";
import { PaymentGateway } from "./payment-gateway.js";

export class PaymentWebhookService {
  constructor(private readonly prisma: PrismaClient, private readonly gateway: PaymentGateway) {}
  async process(notificationId: string, externalPaymentId: string): Promise<"processed" | "duplicate" | "ignored"> {
    const remote = await this.gateway.get(externalPaymentId);
    const payment = await this.prisma.payment.findUnique({ where: { externalPaymentId }, include: { budget: true } });
    if (!payment) return "ignored";
    const eventType = remote.status === "approved" ? "PaymentConfirmed" : remote.status === "rejected" ? "PaymentFailed" : undefined;
    if (!eventType) return "ignored";
    try {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.inboxMessage.create({ data: { messageId: `mercado-pago:${notificationId}`, type: "MercadoPagoWebhook", correlationId: payment.idempotencyKey, payloadHash: externalPaymentId } });
        await tx.payment.update({ where: { id: payment.id }, data: { status: remote.status === "approved" ? "CONFIRMED" : "REJECTED" } });
        await tx.outboxMessage.create({ data: { aggregateId: payment.budget.externalOrderId, type: eventType, correlationId: payment.idempotencyKey, payload: { paymentId: payment.id, externalPaymentId } } });
      });
      return "processed";
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return "duplicate";
      throw error;
    }
  }
}
