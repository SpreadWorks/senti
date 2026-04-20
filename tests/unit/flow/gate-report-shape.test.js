import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGateReport } from "../../../src/flow/lib/run-gate.js";

// -----------------------------------------------------------------------------
// REQ-8: gate が返す結果には level / phase / 構造化 evaluations が必須
// -----------------------------------------------------------------------------

describe("buildGateReport (REQ-8)", () => {
  const evaluations = [
    {
      guardrail_id: "g1",
      result: "pass",
      reason: "looks ok",
      category: "requirements",
    },
  ];

  it("includes level, phase, and evaluations for each valid combination", () => {
    const combos = [
      ["parent", "draft"],
      ["parent", "spec"],
      ["task", "task-spec"],
      ["task", "task-impl"],
      ["integration", "integration"],
    ];
    for (const [level, phase] of combos) {
      const report = buildGateReport({ level, phase, evaluations });
      assert.equal(report.level, level);
      assert.equal(report.phase, phase);
      assert.equal(report.evaluations.length, 1);
      assert.equal(report.evaluations[0].guardrail_id, "g1");
      assert.equal(report.evaluations[0].category, "requirements");
    }
  });

  it("throws when level is missing", () => {
    assert.throws(() => buildGateReport({ phase: "spec", evaluations }), /level/i);
  });

  it("throws when phase is missing", () => {
    assert.throws(() => buildGateReport({ level: "parent", evaluations }), /phase/i);
  });

  it("throws when evaluations is missing", () => {
    assert.throws(() => buildGateReport({ level: "parent", phase: "spec" }), /evaluations/i);
  });

  it("throws when an evaluation entry lacks category", () => {
    assert.throws(
      () =>
        buildGateReport({
          level: "parent",
          phase: "spec",
          evaluations: [{ guardrail_id: "g1", result: "pass", reason: "x" }],
        }),
      /category/i,
    );
  });
});
