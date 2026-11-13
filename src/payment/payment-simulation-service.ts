import { PrismaClient } from "@prisma/client";
import { MockPaymentGateway } from "./mock-payment-gateway.js";
import { PaymentWebhookService } from "./payment-webhook-service.js";

export type SimulatedPaymentStatus = "approved" | "rejected";

export class PaymentSimulationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly gateway: MockPaymentGateway,
    private readonly webhook: PaymentWebhookService,
  ) {}

  async simulate(orderId: string, status: SimulatedPaymentStatus) {
    const payment = await this.prisma.payment.findFirst({
      where: { budget: { externalOrderId: orderId } },
      orderBy: { createdAt: "desc" },
    });
    if (!payment?.externalPaymentId) throw new Error("Pagamento da OS nao encontrado");

    this.gateway.setStatus(payment.externalPaymentId, status);
    const notificationId = `hml-simulation:${payment.id}:${status}`;
    const result = await this.webhook.process(notificationId, payment.externalPaymentId);
    return { paymentId: payment.id, externalPaymentId: payment.externalPaymentId, status, result };
  }
}
