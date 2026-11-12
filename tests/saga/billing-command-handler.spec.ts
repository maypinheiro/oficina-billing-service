import assert from "node:assert/strict";
import test from "node:test";
import { BillingCommandHandler, BillingStore } from "../../src/saga/billing-command-handler.js";
import { createMessageEnvelope } from "../../src/messaging/message-envelope.js";

const calls: Array<string | Record<string, unknown>> = [];
const store: BillingStore = {
  createQuote: async (_orderId, _payload, context) => { calls.push("createQuote", context); return { quoteId: "q-1" }; },
  cancelQuote: async () => { calls.push("cancelQuote"); }, cancelQuoteApproval: async () => { calls.push("cancelQuoteApproval"); },
  requestPayment: async () => { calls.push("requestPayment"); return { paymentId: "p-1" }; },
  cancelPayment: async () => { calls.push("cancelPayment"); }, refundPayment: async () => { calls.push("refundPayment"); },
};
const command = (messageType: string) => createMessageEnvelope({ messageType, messageKind: "command", source: "os-service", aggregateId: "os-1", correlationId: "corr-1", sagaId: "saga-1", payload: {} });

test("creates a quote and preserves the causal chain", async () => {
  calls.length = 0; const input = command("CreateQuote"); const event = await new BillingCommandHandler(store).handle(input);
  assert.equal(event.messageType, "QuoteCreated"); assert.equal(event.causationId, input.messageId); assert.deepEqual(event.payload, { quoteId: "q-1" });
  assert.deepEqual(calls, ["createQuote", { correlationId: "corr-1", sagaId: "saga-1" }]);
});
test("executes billing compensations idempotently through the store", async () => {
  calls.length = 0; const handler = new BillingCommandHandler(store);
  assert.equal((await handler.handle(command("CancelQuoteApproval"))).messageType, "QuoteApprovalCancelled");
  assert.equal((await handler.handle(command("CancelPayment"))).messageType, "PaymentCancelled");
  assert.equal((await handler.handle(command("RefundPayment"))).messageType, "PaymentRefunded");
  assert.deepEqual(calls, ["cancelQuoteApproval", "cancelPayment", "refundPayment"]);
});
test("rejects unknown commands", async () => { await assert.rejects(() => new BillingCommandHandler(store).handle(command("Unknown")), /nao suportado/); });
