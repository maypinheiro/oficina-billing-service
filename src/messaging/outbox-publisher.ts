import { PrismaClient } from "@prisma/client";
import { AwsMessageTransport } from "./aws-transport.js";
import { createMessageEnvelope } from "./message-envelope.js";
import { log } from "../observability/logger.js";

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const outboxStatus = { pending: "PENDING", published: "PUBLISHED", failed: "FAILED" } as const;

export class OutboxPublisher {
  private running = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly transport: AwsMessageTransport,
    private readonly topicArn: string,
  ) {}

  async publishPending(): Promise<number> {
    const messages = await this.prisma.outboxMessage.findMany({
      where: {
        status: outboxStatus.pending,
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    });
    let claimed = 0;

    for (const message of messages) {
      const attempt = message.attempts + 1;
      const claim = await this.prisma.outboxMessage.updateMany({
        where: { id: message.id, status: outboxStatus.pending, attempts: message.attempts },
        data: { attempts: { increment: 1 } },
      });
      if (claim.count !== 1) continue;
      claimed += 1;

      try {
        await this.transport.publishEvent(this.topicArn, createMessageEnvelope({
          messageId: message.id,
          messageType: message.type,
          messageKind: "event",
          source: "billing-service",
          aggregateId: message.aggregateId,
          correlationId: message.correlationId,
          sagaId: message.sagaId ?? undefined,
          payload: message.payload,
        }));
        await this.prisma.outboxMessage.updateMany({
          where: { id: message.id, status: outboxStatus.pending, attempts: attempt },
          data: { status: outboxStatus.published, publishedAt: new Date(), nextAttemptAt: null },
        });
        log("info", "outbox_event_published", { messageId: message.id, messageType: message.type, sagaId: message.sagaId });
      } catch (error) {
        await this.prisma.outboxMessage.update({
          where: { id: message.id },
          data: {
            status: attempt >= 5 ? outboxStatus.failed : outboxStatus.pending,
            nextAttemptAt: new Date(Date.now() + Math.min(30_000, 1000 * 2 ** attempt)),
          },
        });
        log("error", "outbox_event_publish_failed", { messageId: message.id, messageType: message.type, attempts: attempt, errorType: error instanceof Error ? error.name : "UnknownError" });
      }
    }
    return claimed;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    log("info", "outbox_publisher_started");
    while (this.running) {
      const count = await this.publishPending().catch((error) => {
        log("error", "outbox_iteration_failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        return 0;
      });
      if (this.running) await wait(count > 0 ? 100 : 1000);
    }
  }

  stop(): void { this.running = false; }
}
