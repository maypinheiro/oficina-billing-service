import { MessageInbox, IdempotentMessageHandler } from "../messaging/idempotent-handler.js";
import { parseQueueBody } from "../messaging/message-envelope.js";
import { AwsMessageTransport } from "../messaging/aws-transport.js";
import { BillingCommandHandler } from "./billing-command-handler.js";
import { log } from "../observability/logger.js";
import { metrics, trace } from "../observability/telemetry.js";
export class BillingMessageProcessor {
  private readonly idempotency: IdempotentMessageHandler;
  constructor(inbox: MessageInbox, private readonly handler: BillingCommandHandler, private readonly transport: AwsMessageTransport, private readonly topicArn: string) { this.idempotency = new IdempotentMessageHandler(inbox); }
  async process(body: string): Promise<"processed" | "duplicate"> {
    const command = parseQueueBody(body);
    const started = performance.now(); const tags = [`message_type:${command.messageType}`];
    return trace("messaging.command.process", { "messaging.system": "aws_sqs", "messaging.operation": "process", "messaging.message.type": command.messageType, "saga.id": command.sagaId, "correlation.id": command.correlationId }, async () => {
      try {
        const result = await this.idempotency.handle(command, async () => this.transport.publishEvent(this.topicArn, await this.handler.handle(command)));
        metrics.increment(`saga.messages.${result}`, 1, tags); metrics.histogram("saga.message.duration_ms", performance.now() - started, tags);
        log("info", "saga_command_processed", { correlationId: command.correlationId, sagaId: command.sagaId, eventId: command.messageId, ordemServicoId: command.aggregateId, messageType: command.messageType, result }); return result;
      } catch (error) {
        metrics.increment("saga.messages.failed", 1, tags); log("error", "saga_command_failed", { correlationId: command.correlationId, sagaId: command.sagaId, eventId: command.messageId, ordemServicoId: command.aggregateId, messageType: command.messageType, errorType: error instanceof Error ? error.name : "UnknownError" }); throw error;
      }
    });
  }
}
