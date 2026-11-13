import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { createHmac } from "node:crypto";
import { createRequestHandler, handleRequest, route } from "../src/app.js";
import { PaymentWebhookService } from "../src/payment/payment-webhook-service.js";
import { BudgetDecisionService } from "../src/budget/budget-decision-service.js";
import { PaymentSimulationService } from "../src/payment/payment-simulation-service.js";

describe("health endpoint", () => {
  it("returns service identity", () => {
    assert.deepEqual(route("GET", "/health"), {
      statusCode: 200,
      body: { status: "ok", service: "oficina-billing-service" }
    });
  });

  it("returns 404 for unknown routes", () => {
    assert.equal(route("GET", "/unknown").statusCode, 404);
  });

  it("writes the HTTP response", () => {
    let statusCode = 0;
    let payload = "";
    const request = { method: "GET", url: "/health" } as IncomingMessage;
    const response = {
      writeHead(code: number) { statusCode = code; return this; },
      end(body: string) { payload = body; return this; }
    } as unknown as ServerResponse;

    handleRequest(request, response);
    assert.equal(statusCode, 200);
    assert.equal(JSON.parse(payload).service, "oficina-billing-service");
  });

  it("validates and acknowledges Mercado Pago webhook", async () => {
    const secret = "secret"; const ts = "1704908010"; const dataId = "pay-1"; const requestId = "req-1";
    const signature = createHmac("sha256", secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
    const request = Readable.from([JSON.stringify({ id: "notification-1", data: { id: dataId } })]) as IncomingMessage;
    request.method = "POST"; request.url = `/webhooks/mercado-pago?data.id=${dataId}`; request.headers = { "x-signature": `ts=${ts},v1=${signature}`, "x-request-id": requestId };
    let statusCode = 0; let payload = "";
    const response = { writeHead(code: number) { statusCode = code; return this; }, end(body: string) { payload = body; return this; } } as unknown as ServerResponse;
    const service = { process: async () => "processed" as const } as unknown as PaymentWebhookService;
    await createRequestHandler(service, secret)(request, response);
    assert.equal(statusCode, 200); assert.equal(JSON.parse(payload).result, "processed");
  });

  it("rejects webhook with invalid signature", async () => {
    const request = Readable.from([JSON.stringify({ data: { id: "pay-1" } })]) as IncomingMessage;
    request.method = "POST"; request.url = "/webhooks/mercado-pago?data.id=pay-1"; request.headers = { "x-signature": "invalid" };
    let statusCode = 0; const response = { writeHead(code: number) { statusCode = code; return this; }, end() { return this; } } as unknown as ServerResponse;
    const service = { process: async () => "processed" as const } as unknown as PaymentWebhookService;
    await createRequestHandler(service, "secret")(request, response); assert.equal(statusCode, 401);
  });

  it("receives an approved budget decision", async () => {
    const request = Readable.from([JSON.stringify({ decision: "approve" })]) as IncomingMessage;
    request.method = "POST"; request.url = "/budgets/OS-1/decision"; request.headers = {};
    let statusCode = 0; let payload = "";
    const response = { writeHead(code: number) { statusCode = code; return this; }, end(body: string) { payload = body; return this; } } as unknown as ServerResponse;
    const webhook = { process: async () => "processed" as const } as unknown as PaymentWebhookService;
    const decisions = { decide: async () => ({ status: "APPROVED" as const, event: "QuoteApproved" }) } as unknown as BudgetDecisionService;
    await createRequestHandler(webhook, "secret", decisions)(request, response);
    assert.equal(statusCode, 200); assert.equal(JSON.parse(payload).event, "QuoteApproved");
  });

  it("rejects an invalid budget decision", async () => {
    const request = Readable.from([JSON.stringify({ decision: "maybe" })]) as IncomingMessage;
    request.method = "POST"; request.url = "/budgets/OS-1/decision"; request.headers = {};
    let statusCode = 0;
    const response = { writeHead(code: number) { statusCode = code; return this; }, end() { return this; } } as unknown as ServerResponse;
    const webhook = { process: async () => "processed" as const } as unknown as PaymentWebhookService;
    await createRequestHandler(webhook, "secret", {} as BudgetDecisionService)(request, response);
    assert.equal(statusCode, 400);
  });

  it("accepts payment simulation only when the HML service is enabled", async () => {
    const request = Readable.from([JSON.stringify({ status: "approved" })]) as IncomingMessage;
    request.method = "POST"; request.url = "/payments/order-1/simulate"; request.headers = {};
    let statusCode = 0; let payload = "";
    const response = { writeHead(code: number) { statusCode = code; return this; }, end(body: string) { payload = body; return this; } } as unknown as ServerResponse;
    const webhook = {} as PaymentWebhookService;
    const simulation = { simulate: async () => ({ status: "approved", result: "processed" }) } as unknown as PaymentSimulationService;

    await createRequestHandler(webhook, "secret", undefined, simulation)(request, response);
    assert.equal(statusCode, 200);
    assert.equal(JSON.parse(payload).result, "processed");
  });

  it("hides payment simulation when it is disabled", async () => {
    const request = Readable.from([JSON.stringify({ status: "rejected" })]) as IncomingMessage;
    request.method = "POST"; request.url = "/payments/order-1/simulate"; request.headers = {};
    let statusCode = 0;
    const response = { writeHead(code: number) { statusCode = code; return this; }, end() { return this; } } as unknown as ServerResponse;

    await createRequestHandler({} as PaymentWebhookService, "secret")(request, response);
    assert.equal(statusCode, 404);
  });

  it("rejects an invalid payment simulation status", async () => {
    const request = Readable.from([JSON.stringify({ status: "pending" })]) as IncomingMessage;
    request.method = "POST"; request.url = "/payments/order-1/simulate"; request.headers = {};
    let statusCode = 0;
    const response = { writeHead(code: number) { statusCode = code; return this; }, end() { return this; } } as unknown as ServerResponse;

    await createRequestHandler({} as PaymentWebhookService, "secret", undefined, {} as PaymentSimulationService)(request, response);
    assert.equal(statusCode, 400);
  });
});
