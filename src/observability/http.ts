import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { log } from "./logger.js";
import { activeTraceId, metrics } from "./telemetry.js";

type Handler = (request: IncomingMessage, response: ServerResponse) => void | Promise<void>;
export function observeHttp(handler: Handler): Handler {
  return async (request, response) => {
    const started = performance.now();
    const supplied = request.headers["x-correlation-id"];
    const correlationId = typeof supplied === "string" && /^[\w.-]{1,128}$/.test(supplied) ? supplied : randomUUID();
    response.setHeader("x-correlation-id", correlationId);
    response.once("finish", () => {
      const route = new URL(request.url ?? "/", "http://localhost").pathname;
      const tags = [`method:${request.method ?? "UNKNOWN"}`, `route:${route}`, `status_code:${response.statusCode}`];
      metrics.increment("http.requests", 1, tags); metrics.histogram("http.request.duration_ms", performance.now() - started, tags);
      if (response.statusCode >= 500) metrics.increment("http.errors", 1, tags);
      log(response.statusCode >= 500 ? "error" : "info", "http_request_completed", { correlationId, traceId: activeTraceId(), method: request.method, route, statusCode: response.statusCode, durationMs: Math.round(performance.now() - started) });
    });
    await handler(request, response);
  };
}
