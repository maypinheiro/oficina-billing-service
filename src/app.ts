import type { IncomingMessage, ServerResponse } from "node:http";

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
