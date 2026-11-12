import { createMessageEnvelope, MessageEnvelope } from "../messaging/message-envelope.js";

export type BillingCommand = "CreateQuote" | "CancelQuote" | "CancelQuoteApproval" | "RequestPayment" | "CancelPayment" | "RefundPayment";
export type SagaContext = Pick<MessageEnvelope, "correlationId" | "sagaId">;
export interface BillingStore {
  createQuote(orderId: string, payload: unknown, context: SagaContext): Promise<{ quoteId: string }>;
  cancelQuote(orderId: string): Promise<void>;
  cancelQuoteApproval(orderId: string): Promise<void>;
  requestPayment(orderId: string): Promise<{ paymentId: string; status?: string; qrCode?: string }>;
  cancelPayment(orderId: string): Promise<void>;
  refundPayment(orderId: string): Promise<void>;
}

const eventByCommand: Record<BillingCommand, string> = {
  CreateQuote: "QuoteCreated", CancelQuote: "QuoteCancelled", CancelQuoteApproval: "QuoteApprovalCancelled",
  RequestPayment: "PaymentCreated", CancelPayment: "PaymentCancelled", RefundPayment: "PaymentRefunded",
};

export class BillingCommandHandler {
  constructor(private readonly store: BillingStore) {}
  async handle(command: MessageEnvelope): Promise<MessageEnvelope> {
    const type = command.messageType as BillingCommand;
    let result: Record<string, unknown> = {};
    if (type === "CreateQuote") {
      result = await this.store.createQuote(command.aggregateId, command.payload, {
        correlationId: command.correlationId,
        sagaId: command.sagaId,
      });
    }
    else if (type === "CancelQuote") await this.store.cancelQuote(command.aggregateId);
    else if (type === "CancelQuoteApproval") await this.store.cancelQuoteApproval(command.aggregateId);
    else if (type === "RequestPayment") result = await this.store.requestPayment(command.aggregateId);
    else if (type === "CancelPayment") await this.store.cancelPayment(command.aggregateId);
    else if (type === "RefundPayment") await this.store.refundPayment(command.aggregateId);
    else throw new Error(`Comando Billing nao suportado: ${command.messageType}`);
    return createMessageEnvelope({ messageType: eventByCommand[type], messageKind: "event", source: "billing-service", aggregateId: command.aggregateId, correlationId: command.correlationId, causationId: command.messageId, sagaId: command.sagaId, payload: result });
  }
}
