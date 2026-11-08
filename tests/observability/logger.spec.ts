import assert from "node:assert/strict";
import { it } from "node:test";
import { log } from "../../src/observability/logger.js";

it("emits correlated JSON and redacts sensitive fields", () => {
  const original = console.info; let output = ""; console.info = (line?: unknown) => { output = String(line); };
  try { log("info", "processed", { correlationId: "corr-1", sagaId: "saga-1", token: "secret-value", cpf: "52998224725" }); } finally { console.info = original; }
  const entry = JSON.parse(output); assert.equal(entry.correlationId, "corr-1"); assert.equal(entry.sagaId, "saga-1"); assert.equal(entry.token, "[REDACTED]"); assert.equal(entry.cpf, "[REDACTED]");
});
