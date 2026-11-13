import { PrismaClient } from "@prisma/client";
import { createMessageEnvelope, MessageEnvelope } from "../messaging/message-envelope.js";

export type BudgetDecision = "approve" | "reject";

export interface DomainEventPublisher {
  publishEvent(topicArn: string, message: MessageEnvelope): Promise<void>;
}

export class BudgetDecisionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly publisher: DomainEventPublisher,
    private readonly topicArn: string,
  ) {}

  async decide(orderId: string, decision: BudgetDecision): Promise<{ status: "APPROVED" | "REJECTED"; event: string }> {
    const status = decision === "approve" ? "APPROVED" : "REJECTED";
    const event = decision === "approve" ? "QuoteApproved" : "QuoteRejected";
    const current = await this.prisma.budget.findUniqueOrThrow({
      where: { externalOrderId: orderId },
      select: { sagaId: true, correlationId: true },
    });
    if (!current.sagaId || !current.correlationId) {
      throw new Error("Orcamento sem contexto da Saga");
    }
    const budget = await this.prisma.budget.update({
      where: { externalOrderId: orderId },
      data: { status, version: { increment: 1 } },
    });
    const message = createMessageEnvelope({
      messageId: `budget-decision:${budget.id}:${budget.version}`,
      messageType: event,
      messageKind: "event",
      source: "billing-service",
      aggregateId: orderId,
      correlationId: current.correlationId,
      sagaId: current.sagaId,
      payload: { quoteId: budget.id, status },
    });
    await this.publisher.publishEvent(this.topicArn, message);
    return { status, event };
  }
}
