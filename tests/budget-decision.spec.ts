import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";
import { BudgetDecisionService, DomainEventPublisher } from "../src/budget/budget-decision-service.js";
import { MessageEnvelope } from "../src/messaging/message-envelope.js";

describe("budget decision", () => {
  it("approves a budget and publishes QuoteApproved", async () => {
    const updates: unknown[] = [];
    const prisma = { budget: { update: async (args: unknown) => { updates.push(args); return { id: "quote-1", version: 2 }; } } } as unknown as PrismaClient;
    const published: MessageEnvelope[] = [];
    const publisher: DomainEventPublisher = { publishEvent: async (_topic, message) => { published.push(message); } };
    const result = await new BudgetDecisionService(prisma, publisher, "arn:topic").decide("OS-1", "approve");

    assert.deepEqual(result, { status: "APPROVED", event: "QuoteApproved" });
    assert.equal(updates.length, 1);
    assert.equal(published[0].messageType, "QuoteApproved");
    assert.equal(published[0].aggregateId, "OS-1");
    assert.equal(published[0].messageId, "budget-decision:quote-1:2");
  });

  it("rejects a budget and publishes QuoteRejected", async () => {
    const prisma = { budget: { update: async () => ({ id: "quote-2", version: 1 }) } } as unknown as PrismaClient;
    let published: MessageEnvelope | undefined;
    const publisher: DomainEventPublisher = { publishEvent: async (_topic, message) => { published = message; } };
    const result = await new BudgetDecisionService(prisma, publisher, "arn:topic").decide("OS-2", "reject");

    assert.equal(result.status, "REJECTED");
    assert.equal(published?.messageType, "QuoteRejected");
  });
});
