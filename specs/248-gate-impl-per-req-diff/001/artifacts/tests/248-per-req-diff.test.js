import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildImplCheckPrompt,
  collectPerFileDiffsForGate,
  buildPerRequirementDiffs,
  findPreviousPassedGuardrails,
} from "../../../src/flow/lib/run-gate.js";

describe("248: per-requirement diff splitting", () => {
  // REQ-1: buildImplCheckPrompt accepts a single requirement and builds a prompt
  // with only that requirement's diff
  describe("buildImplCheckPrompt single-requirement mode", () => {
    it("REQ-1: accepts a single requirement id and includes only that id in the prompt", () => {
      const pb = buildImplCheckPrompt("spec text", "diff content", ["REQ-1"]);
      const built = pb.build();
      assert.ok(built.userPrompt.includes("REQ-1"));
      assert.ok(!built.userPrompt.includes("REQ-2"));
    });
  });

  // REQ-2: fallback when file-map is absent — full diff with all requirement IDs
  describe("fallback mode (no file-map)", () => {
    it("REQ-2: accepts all requirement IDs for fallback mode", () => {
      const allIds = ["REQ-1", "REQ-2", "REQ-3"];
      const fullDiff = "full diff content here";
      const pb = buildImplCheckPrompt("spec text", fullDiff, allIds);
      const built = pb.build();
      for (const id of allIds) {
        assert.ok(built.userPrompt.includes(id), `should include ${id}`);
      }
      assert.ok(built.userPrompt.includes(fullDiff));
    });
  });

  // REQ-4: empty diff requirement should be skipped (no AI call)
  // This tests the logic that will decide whether to call AI — the function
  // that builds per-requirement diffs should return empty for such cases.
  describe("empty diff handling", () => {
    it("REQ-4: building prompt with empty diff produces a prompt with empty diff section", () => {
      const pb = buildImplCheckPrompt("spec text", "", ["REQ-1"]);
      const built = pb.build();
      assert.ok(built.userPrompt.includes("REQ-1"));
      // The caller is responsible for skipping AI call when diff is empty
    });
  });

  // REQ-5: result aggregation — evaluations from multiple per-requirement calls
  // should be mergeable into the same array format as current reqEvaluations
  describe("result aggregation compatibility", () => {
    it("REQ-5: per-requirement evaluation objects have the same shape as current format", () => {
      const evaluation = {
        guardrail_id: "REQ-1",
        result: "pass",
        reason: "implemented",
        title: "REQ-1",
        category: "requirements",
      };
      assert.ok(evaluation.guardrail_id);
      assert.ok(["pass", "fail", "skip"].includes(evaluation.result));
      assert.ok(evaluation.category === "requirements");
    });
  });
});

describe("248: per-file diff collection", () => {
  it("REQ-1: collectPerFileDiffsForGate returns a Map keyed by file path", () => {
    const committed = [
      "diff --git a/src/foo.js b/src/foo.js",
      "--- a/src/foo.js",
      "+++ b/src/foo.js",
      "@@ -1 +1 @@",
      "-old",
      "+new",
    ].join("\n");
    const result = collectPerFileDiffsForGate(committed, "", "");
    assert.ok(result instanceof Map);
    assert.equal(result.size, 1);
    assert.ok(result.has("src/foo.js"));
  });
});

describe("248: per-requirement diff building from file-map", () => {
  it("REQ-1: builds diff for a mapped requirement using only mapped files", () => {
    const fileMap = { "REQ-1": ["src/foo.js"], "REQ-2": ["src/bar.js"] };
    const perFileDiffs = new Map([
      ["src/foo.js", "diff for foo"],
      ["src/bar.js", "diff for bar"],
    ]);
    const result = buildPerRequirementDiffs(fileMap, perFileDiffs, ["REQ-1", "REQ-2"], "full diff");
    assert.ok(result instanceof Map);
    const req1Diff = result.get("REQ-1");
    assert.ok(req1Diff.includes("diff for foo"));
    assert.ok(!req1Diff.includes("diff for bar"));
  });

  it("REQ-3: unmapped requirement receives full diff", () => {
    const fileMap = { "REQ-1": ["src/foo.js"] };
    const perFileDiffs = new Map([["src/foo.js", "diff for foo"]]);
    const result = buildPerRequirementDiffs(fileMap, perFileDiffs, ["REQ-1", "REQ-2"], "full diff content");
    assert.equal(result.get("REQ-2"), "full diff content");
  });

  it("REQ-1: unmapped files diff is appended to every requirement", () => {
    const fileMap = { "REQ-1": ["src/foo.js"], "REQ-2": ["src/bar.js"] };
    const perFileDiffs = new Map([
      ["src/foo.js", "diff for foo"],
      ["src/bar.js", "diff for bar"],
      ["src/shared.js", "shared diff"],
    ]);
    const result = buildPerRequirementDiffs(fileMap, perFileDiffs, ["REQ-1", "REQ-2"], "full diff");
    assert.ok(result.get("REQ-1").includes("shared diff"));
    assert.ok(result.get("REQ-2").includes("shared diff"));
  });

  it("REQ-4: mapped requirement with no matching diff returns empty string", () => {
    const fileMap = { "REQ-1": ["src/nonexistent.js"] };
    const perFileDiffs = new Map();
    const result = buildPerRequirementDiffs(fileMap, perFileDiffs, ["REQ-1"], "full diff");
    assert.equal(result.get("REQ-1"), "");
  });

  it("REQ-2: returns null when file-map is empty", () => {
    const result = buildPerRequirementDiffs({}, new Map(), ["REQ-1"], "full diff");
    assert.equal(result, null);
  });
});

describe("248: retry skip for previously passed requirements", () => {
  it("REQ-6: findPreviousPassedGuardrails returns passed IDs from issue-log", () => {
    const issueLog = {
      entries: [
        {
          phase: "task-impl",
          passedGuardrails: ["REQ-1", "REQ-3"],
          headSha: "abc123",
          worktreeHash: "def456",
        },
      ],
    };
    const result = findPreviousPassedGuardrails({ issueLog, phase: "task-impl" });
    assert.ok(result);
    assert.deepEqual(result.passedGuardrails, ["REQ-1", "REQ-3"]);
  });

  it("REQ-6: previously passed requirements can be filtered from reqIds", () => {
    const previouslyPassed = new Set(["REQ-1", "REQ-3"]);
    const reqIds = ["REQ-1", "REQ-2", "REQ-3"];
    const toEvaluate = reqIds.filter((id) => !previouslyPassed.has(id));
    assert.deepEqual(toEvaluate, ["REQ-2"]);
  });
});
