import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";
import { AwsMessageTransport } from "../../src/messaging/aws-transport.js";
import { MessageEnvelope } from "../../src/messaging/message-envelope.js";
import { OutboxPublisher } from "../../src/messaging/outbox-publisher.js";

const message = {
  id: "outbox-1", aggregateId: "order-1", type: "PaymentConfirmed", version: 1,
  payload: { paymentId: "payment-1" }, correlationId: "corr-1", sagaId: "saga-1",
  status: "PENDING" as const, attempts: 0, nextAttemptAt: null,
  createdAt: new Date(), publishedAt: null,
};

describe("billing outbox publisher", () => {
  it("claims, publishes and marks an event as published", async () => {
    const updates: unknown[] = [];
    const prisma = { outboxMessage: {
      findMany: async () => [message],
      updateMany: async (args: unknown) => { updates.push(args); return { count: 1 }; },
      update: async () => undefined,
    } } as unknown as PrismaClient;
    let published: MessageEnvelope | undefined;
    const transport = { publishEvent: async (_topic: string, envelope: MessageEnvelope) => { published = envelope; } } as AwsMessageTransport;

    const count = await new OutboxPublisher(prisma, transport, "arn:topic").publishPending();

    assert.equal(count, 1);
    assert.equal(published?.messageType, "PaymentConfirmed");
    assert.equal(published?.messageKind, "event");
    assert.equal(published?.sagaId, "saga-1");
    assert.equal(updates.length, 2);
  });

  it("schedules retry when publication fails", async () => {
    let failureUpdate: unknown;
    const prisma = { outboxMessage: {
      findMany: async () => [message],
      updateMany: async () => ({ count: 1 }),
      update: async (args: unknown) => { failureUpdate = args; },
    } } as unknown as PrismaClient;
    const transport = { publishEvent: async () => { throw new Error("SNS unavailable"); } } as unknown as AwsMessageTransport;

    assert.equal(await new OutboxPublisher(prisma, transport, "arn:topic").publishPending(), 1);
    assert.equal((failureUpdate as { data: { status: string } }).data.status, "PENDING");
  });

  it("skips a message already claimed by another replica", async () => {
    const prisma = { outboxMessage: {
      findMany: async () => [message],
      updateMany: async () => ({ count: 0 }),
    } } as unknown as PrismaClient;
    let published = false;
    const transport = { publishEvent: async () => { published = true; } } as unknown as AwsMessageTransport;

    assert.equal(await new OutboxPublisher(prisma, transport, "arn:topic").publishPending(), 0);
    assert.equal(published, false);
  });

  it("marks an event failed after the fifth publication attempt", async () => {
    let failureUpdate: unknown;
    const prisma = { outboxMessage: {
      findMany: async () => [{ ...message, attempts: 4 }],
      updateMany: async () => ({ count: 1 }),
      update: async (args: unknown) => { failureUpdate = args; },
    } } as unknown as PrismaClient;
    const transport = { publishEvent: async () => { throw new Error("SNS unavailable"); } } as unknown as AwsMessageTransport;

    await new OutboxPublisher(prisma, transport, "arn:topic").publishPending();
    assert.equal((failureUpdate as { data: { status: string } }).data.status, "FAILED");
  });
});
