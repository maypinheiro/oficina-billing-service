import type { IncomingMessage, ServerResponse } from "node:http";
import { validateWebhookSignature } from "./payment/webhook-signature.js";
import { PaymentWebhookService } from "./payment/payment-webhook-service.js";
import { BudgetDecisionService } from "./budget/budget-decision-service.js";
import { PaymentSimulationService } from "./payment/payment-simulation-service.js";

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

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
}

export function createRequestHandler(webhook: PaymentWebhookService, webhookSecret: string, decisions?: BudgetDecisionService, simulation?: PaymentSimulationService) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const decisionMatch = url.pathname.match(/^\/budgets\/([^/]+)\/decision$/);
    const simulationMatch = url.pathname.match(/^\/payments\/([^/]+)\/simulate$/);
    if (req.method === "POST" && simulationMatch) {
      if (!simulation) { res.writeHead(404, { "content-type": "application/json" }); res.end(JSON.stringify({ message: "Not Found" })); return; }
      const body = await readJson(req);
      if (body.status !== "approved" && body.status !== "rejected") { res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ message: "status must be approved or rejected" })); return; }
      const result = await simulation.simulate(decodeURIComponent(simulationMatch[1]), body.status);
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(result)); return;
    }
    if (req.method === "POST" && decisionMatch) {
      if (!decisions) { res.writeHead(503, { "content-type": "application/json" }); res.end(JSON.stringify({ message: "Budget decisions unavailable" })); return; }
      const body = await readJson(req);
      if (body.decision !== "approve" && body.decision !== "reject") { res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ message: "decision must be approve or reject" })); return; }
      const result = await decisions.decide(decodeURIComponent(decisionMatch[1]), body.decision);
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(result)); return;
    }
    if (req.method !== "POST" || url.pathname !== "/webhooks/mercado-pago") return handleRequest(req, res);
    const body = await readJson(req) as { id?: string | number; data?: { id?: string | number } };
    const dataId = url.searchParams.get("data.id") ?? String(body.data?.id ?? "");
    const valid = validateWebhookSignature({ xSignature: String(req.headers["x-signature"] ?? ""), xRequestId: String(req.headers["x-request-id"] ?? ""), dataId, secret: webhookSecret });
    if (!valid) { res.writeHead(401, { "content-type": "application/json" }); res.end(JSON.stringify({ message: "Invalid webhook signature" })); return; }
    const result = await webhook.process(String(body.id ?? dataId), dataId);
    res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ result }));
  };
}
