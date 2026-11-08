import assert from "node:assert/strict";
import test from "node:test";
import { assertMessageEnvelope, createMessageEnvelope, parseQueueBody } from "../../src/messaging/message-envelope.js";
import { IdempotentMessageHandler, MessageInbox } from "../../src/messaging/idempotent-handler.js";
const build = () => createMessageEnvelope({ messageType: "billing.budget.requested", messageKind: "command", source: "os-service", aggregateId: "os-1", correlationId: "corr-1", payload: { orderId: "os-1" } });
test("supports direct SQS and SNS-wrapped envelopes", () => {
  const item = build(); assert.deepEqual(parseQueueBody(JSON.stringify(item)), item); assert.deepEqual(parseQueueBody(JSON.stringify({ Message: JSON.stringify(item) })), item); assert.equal(item.version, 1);
});
test("processes an at-least-once message only once", async () => {
  const ids = new Set<string>(); const inbox: MessageInbox = { claim: async (item) => { if (ids.has(item.messageId)) return false; ids.add(item.messageId); return true; } };
  const handler = new IdempotentMessageHandler(inbox); const item = build(); let calls = 0;
  assert.equal(await handler.handle(item, async () => { calls += 1; }), "processed"); assert.equal(await handler.handle(item, async () => { calls += 1; }), "duplicate"); assert.equal(calls, 1);
});
test("rejects incompatible envelopes", () => {
  assert.throws(() => assertMessageEnvelope(null));
  assert.throws(() => assertMessageEnvelope({ ...build(), messageKind: "invalid" }));
  assert.throws(() => assertMessageEnvelope({ ...build(), version: 0 }));
  assert.throws(() => assertMessageEnvelope({ ...build(), occurredAt: "invalid" }));
  const { payload: _, ...withoutPayload } = build(); assert.throws(() => assertMessageEnvelope(withoutPayload));
});
