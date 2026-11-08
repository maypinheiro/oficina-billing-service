import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { createHmac } from "node:crypto";
import { createRequestHandler, handleRequest, route } from "../src/app.js";
import { PaymentWebhookService } from "../src/payment/payment-webhook-service.js";

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
});
