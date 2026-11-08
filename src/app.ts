import type { IncomingMessage, ServerResponse } from "node:http";
import { validateWebhookSignature } from "./payment/webhook-signature.js";
import { PaymentWebhookService } from "./payment/payment-webhook-service.js";

export type HttpResult = { statusCode: number; body: Record<string, unknown> };

export function route(method: string | undefined, path: string): HttpResult {
  if (method === "GET" && path === "/health") {
    return { statusCode: 200, body: { status: "ok", service: "oficina-billing-service" } };
  }
  return { statusCode: 404, body: { message: "Not Found" } };
}

export function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  const result = route(req.method, path);
  res.writeHead(result.statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(result.body));
}

export function createRequestHandler(webhook: PaymentWebhookService, webhookSecret: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method !== "POST" || url.pathname !== "/webhooks/mercado-pago") return handleRequest(req, res);
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { id?: string | number; data?: { id?: string | number } };
    const dataId = url.searchParams.get("data.id") ?? String(body.data?.id ?? "");
    const valid = validateWebhookSignature({ xSignature: String(req.headers["x-signature"] ?? ""), xRequestId: String(req.headers["x-request-id"] ?? ""), dataId, secret: webhookSecret });
    if (!valid) { res.writeHead(401, { "content-type": "application/json" }); res.end(JSON.stringify({ message: "Invalid webhook signature" })); return; }
    const result = await webhook.process(String(body.id ?? dataId), dataId);
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ result }));
  };
}
