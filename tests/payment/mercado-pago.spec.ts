import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { MercadoPagoGateway } from "../../src/payment/mercado-pago-gateway.js";
import { MockPaymentGateway } from "../../src/payment/mock-payment-gateway.js";
import { validateWebhookSignature } from "../../src/payment/webhook-signature.js";

test("creates Pix with authentication and idempotency", async () => {
  let request: { url?: string; init?: RequestInit } = {};
  const fetchMock = async (url: string | URL | Request, init?: RequestInit) => { request = { url: String(url), init }; return new Response(JSON.stringify({ id: 123, status: "pending", point_of_interaction: { transaction_data: { qr_code: "pix" } } }), { status: 201 }); };
  const result = await new MercadoPagoGateway("token", "https://mp.test", fetchMock).create({ amount: 10, description: "OS", externalReference: "os-1", idempotencyKey: "pay-os-1", payerEmail: "test@example.com" });
  assert.equal(result.qrCode, "pix"); assert.equal(request.url, "https://mp.test/v1/payments");
  const headers = request.init?.headers as Record<string, string>; assert.equal(headers.Authorization, "Bearer token"); assert.equal(headers["X-Idempotency-Key"], "pay-os-1");
});
test("uses official refund endpoint and maps approved status", async () => { const calls: string[] = []; const fetchMock = async (url: string | URL | Request) => { calls.push(String(url)); return new Response(JSON.stringify({ id: 1, status: "approved" }), { status: 200 }); }; const gateway = new MercadoPagoGateway("token", "https://mp.test", fetchMock); assert.equal((await gateway.get("1")).status, "approved"); await gateway.refund("1", "refund-1"); assert.equal(calls[1], "https://mp.test/v1/payments/1/refunds"); });
test("fails safely when provider rejects the operation", async () => { const fetchMock = async () => new Response("bad", { status: 401 }); await assert.rejects(() => new MercadoPagoGateway("token", "https://mp.test", fetchMock).get("1"), /401/); assert.throws(() => new MercadoPagoGateway(""), /obrigatorio/); });
test("mock is idempotent and supports compensation", async () => { const gateway = new MockPaymentGateway(); const input = { amount: 10, description: "OS", externalReference: "os-1", idempotencyKey: "key", payerEmail: "test@example.com" }; assert.deepEqual(await gateway.create(input), await gateway.create(input)); assert.equal((await gateway.cancel("1")).status, "cancelled"); assert.equal((await gateway.refund("1", "refund-1")).status, "refunded"); });
test("validates Mercado Pago HMAC signature", () => { const secret = "secret"; const ts = "1704908010"; const manifest = `id:123;request-id:req-1;ts:${ts};`; const hash = createHmac("sha256", secret).update(manifest).digest("hex"); assert.equal(validateWebhookSignature({ xSignature: `ts=${ts},v1=${hash}`, xRequestId: "req-1", dataId: "123", secret }), true); assert.equal(validateWebhookSignature({ xSignature: `ts=${ts},v1=invalid`, xRequestId: "req-1", dataId: "123", secret }), false); });
