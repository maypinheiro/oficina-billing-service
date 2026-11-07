import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleRequest, route } from "../src/app.js";

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
});
