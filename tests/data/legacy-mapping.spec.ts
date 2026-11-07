import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertMoney, mapLegacyBudgetStatus } from "../../src/data/legacy-mapping.js";

describe("legacy billing mapping", () => {
  it("maps every legacy status", () => {
    assert.equal(mapLegacyBudgetStatus("PENDENTE"), "PENDING");
    assert.equal(mapLegacyBudgetStatus("APROVADO"), "APPROVED");
    assert.equal(mapLegacyBudgetStatus("REJEITADO"), "REJECTED");
  });
  it("rejects unsupported status", () => assert.throws(() => mapLegacyBudgetStatus("UNKNOWN")));
  it("normalizes money", () => {
    assert.equal(assertMoney("10.5"), "10.50");
    assert.throws(() => assertMoney(-1));
  });
});
