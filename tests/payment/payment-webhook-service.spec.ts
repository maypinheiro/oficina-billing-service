import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";

import { PaymentGateway } from "../../src/payment/payment-gateway.js";
import { PaymentWebhookService } from "../../src/payment/payment-webhook-service.js";

const paymentGateway = (status: "approved" | "rejected" | "pending"): PaymentGateway => ({
  create: async () => ({ id: "payment-remote", status }),
  get: async () => ({ id: "payment-remote", status }),
  cancel: async () => ({ id: "payment-remote", status: "cancelled" }),
  refund: async () => ({ id: "payment-remote", status: "refunded" }),
});

describe("payment webhook Saga context", () => {
  it("publishes PaymentConfirmed with the original Saga context", async () => {
    const created: Array<Record<string, unknown>> = [];
    const transaction = {
      inboxMessage: { create: async (args: { data: Record<string, unknown> }) => { created.push(args.data); } },
      payment: { update: async () => undefined },
      outboxMessage: { create: async (args: { data: Record<string, unknown> }) => { created.push(args.data); } },
    };
    const prisma = {
      payment: { findUnique: async () => ({
        id: "payment-1",
        idempotencyKey: "payment:order-1",
        budget: { externalOrderId: "order-1", sagaId: "saga-1", correlationId: "corr-1" },
      }) },
      $transaction: async (operation: (tx: typeof transaction) => Promise<void>) => operation(transaction),
    } as unknown as PrismaClient;

    const result = await new PaymentWebhookService(prisma, paymentGateway("approved")).process("notification-1", "payment-remote");

    assert.equal(result, "processed");
    assert.deepEqual(created[1], {
      aggregateId: "order-1",
      type: "PaymentConfirmed",
      correlationId: "corr-1",
      sagaId: "saga-1",
      payload: { paymentId: "payment-1", externalPaymentId: "payment-remote" },
    });
  });

  it("rejects a payment without Saga context", async () => {
    const prisma = {
      payment: { findUnique: async () => ({
        id: "payment-1",
        idempotencyKey: "payment:order-1",
        budget: { externalOrderId: "order-1", sagaId: null, correlationId: null },
      }) },
    } as unknown as PrismaClient;

    await assert.rejects(
      () => new PaymentWebhookService(prisma, paymentGateway("approved")).process("notification-1", "payment-remote"),
      /sem contexto da Saga/,
    );
  });
});
