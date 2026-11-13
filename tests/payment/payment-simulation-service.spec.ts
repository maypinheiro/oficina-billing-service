import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";
import { MockPaymentGateway } from "../../src/payment/mock-payment-gateway.js";
import { PaymentSimulationService } from "../../src/payment/payment-simulation-service.js";
import { PaymentWebhookService } from "../../src/payment/payment-webhook-service.js";

describe("HML payment simulation", () => {
  it("routes an approved simulation through the real webhook service", async () => {
    const prisma = {
      payment: { findFirst: async () => ({ id: "payment-1", externalPaymentId: "mock-order-1" }) },
    } as unknown as PrismaClient;
    const gateway = new MockPaymentGateway();
    let call: string[] = [];
    const webhook = { process: async (notificationId: string, externalId: string) => {
      call = [notificationId, externalId, (await gateway.get(externalId)).status];
      return "processed" as const;
    } } as unknown as PaymentWebhookService;

    const result = await new PaymentSimulationService(prisma, gateway, webhook).simulate("order-1", "approved");

    assert.equal(result.status, "approved");
    assert.deepEqual(call, ["hml-simulation:payment-1:approved", "mock-order-1", "approved"]);
  });

  it("rejects a simulation when the order has no payment", async () => {
    const prisma = { payment: { findFirst: async () => null } } as unknown as PrismaClient;
    const gateway = new MockPaymentGateway();
    await assert.rejects(
      () => new PaymentSimulationService(prisma, gateway, {} as PaymentWebhookService).simulate("missing", "rejected"),
      /nao encontrado/,
    );
  });
});
