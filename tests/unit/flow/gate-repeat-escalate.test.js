import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import {
  normalize,
  jaccard,
  findPreviousFailedEvaluations,
  assertNoRepeatedFail,
  buildFailedEvaluations,
  appendIssueLogFromGateResult,
} from "../../../src/flow/lib/run-gate.js";

// -----------------------------------------------------------------------------
// spec 253: detect repeated similar FAIL via word-set Jaccard similarity
// -----------------------------------------------------------------------------

describe("normalize (spec 253)", () => {
  it("lowercases and strips punctuation", () => {
    const s = normalize("Hello, World!");
    assert.deepEqual([...s].sort(), ["hello", "world"]);
  });

  it("preserves hyphens within tokens, splits on slash", () => {
    assert.deepEqual([...normalize("REQ-7/REQ-8")].sort(), ["req-7", "req-8"]);
  });

  it("returns empty Set for null / undefined / empty", () => {
    assert.equal(normalize(null).size, 0);
    assert.equal(normalize(undefined).size, 0);
    assert.equal(normalize("").size, 0);
  });
});

describe("jaccard (spec 253)", () => {
  it("returns intersection / union for non-empty sets", () => {
    const v = jaccard(new Set(["xx", "yy"]), new Set(["xx", "zz"]));
    assert.ok(Math.abs(v - 1 / 3) < 1e-9);
  });

  it("returns 0 when either set is empty", () => {
    assert.equal(jaccard(new Set(), new Set()), 0);
    assert.equal(jaccard(new Set(["a"]), new Set()), 0);
  });
});

describe("buildFailedEvaluations (REQ-4)", () => {
  it("extracts only FAIL evaluations as { guardrail_id, reason } pairs", () => {
    const evaluations = [
      { guardrail_id: "g1", result: "pass", reason: "ok" },
      { guardrail_id: "g2", result: "fail", reason: "bad 1" },
      { guardrail_id: "g3", result: "skip", reason: "n/a" },
      { guardrail_id: "g4", result: "fail", reason: "bad 2" },
    ];
    assert.deepEqual(buildFailedEvaluations(evaluations), [
      { guardrail_id: "g2", reason: "bad 1" },
      { guardrail_id: "g4", reason: "bad 2" },
    ]);
  });

  it("returns empty array when no FAIL evaluations are present", () => {
    const evaluations = [
      { guardrail_id: "g1", result: "pass", reason: "ok" },
    ];
    assert.deepEqual(buildFailedEvaluations(evaluations), []);
  });

  it("returns empty array for null or undefined input", () => {
    assert.deepEqual(buildFailedEvaluations(null), []);
    assert.deepEqual(buildFailedEvaluations(undefined), []);
  });
});

describe("findPreviousFailedEvaluations (spec 253: flatten all prior)", () => {
  const phase = "task-impl";

  it("flattens all same-phase failedEvaluations in chronological order", () => {
    const issueLog = {
      entries: [
        {
          step: "impl-gate",
          phase,
          failedEvaluations: [{ guardrail_id: "old", reason: "old reason" }],
        },
        {
          step: "impl-gate",
          phase,
          failedEvaluations: [{ guardrail_id: "new", reason: "new reason" }],
        },
      ],
    };
    assert.deepEqual(findPreviousFailedEvaluations({ issueLog, phase }), [
      { guardrail_id: "old", reason: "old reason" },
      { guardrail_id: "new", reason: "new reason" },
    ]);
  });

  it("ignores entries from other phases", () => {
    const issueLog = {
      entries: [
        {
          step: "impl-gate",
          phase,
          failedEvaluations: [{ guardrail_id: "match", reason: "r" }],
        },
        {
          step: "gate-integration",
          phase: "integration",
          failedEvaluations: [{ guardrail_id: "other", reason: "x" }],
        },
      ],
    };
    assert.deepEqual(findPreviousFailedEvaluations({ issueLog, phase }), [
      { guardrail_id: "match", reason: "r" },
    ]);
  });

  it("returns [] when there is no prior entry with failedEvaluations for this phase", () => {
    const issueLog = {
      entries: [
        { step: "impl-gate", phase, reason: "legacy fail without field" },
      ],
    };
    assert.deepEqual(findPreviousFailedEvaluations({ issueLog, phase }), []);
  });

  it("returns [] for an empty / null issue-log", () => {
    assert.deepEqual(findPreviousFailedEvaluations({ issueLog: { entries: [] }, phase }), []);
    assert.deepEqual(findPreviousFailedEvaluations({ issueLog: null, phase }), []);
  });
});

describe("assertNoRepeatedFail (REQ-1, REQ-5, REQ-6)", () => {
  const phase = "task-impl";

  it("throws ESCALATE_REPEATED_FAIL when a (guardrail, normalized reason) pair matches the previous FAIL", () => {
    const issueLog = {
      entries: [
        {
          step: "impl-gate",
          phase,
          failedEvaluations: [{ guardrail_id: "g-same", reason: "Same Reason" }],
        },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "g-same", result: "fail", reason: "  SAME   reason  " },
    ];
    assert.throws(
      () => assertNoRepeatedFail({ issueLog, phase, currentEvaluations }),
      (err) => {
        assert.equal(err.code, "ESCALATE_REPEATED_FAIL");
        assert.equal(err.data.phase, phase);
        assert.ok(Array.isArray(err.data.matched));
        assert.equal(err.data.matched.length, 1);
        assert.equal(err.data.matched[0].guardrail_id, "g-same");
        return true;
      },
    );
  });

  it("does not throw when guardrail_id differs", () => {
    const issueLog = {
      entries: [
        {
          step: "impl-gate",
          phase,
          failedEvaluations: [{ guardrail_id: "g-a", reason: "reason" }],
        },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "g-b", result: "fail", reason: "reason" },
    ];
    assertNoRepeatedFail({ issueLog, phase, currentEvaluations });
  });

  it("does not throw when reason differs after normalization", () => {
    const issueLog = {
      entries: [
        {
          step: "impl-gate",
          phase,
          failedEvaluations: [{ guardrail_id: "g1", reason: "foo bar" }],
        },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "g1", result: "fail", reason: "foo baz" },
    ];
    assertNoRepeatedFail({ issueLog, phase, currentEvaluations });
  });

  it("does not throw when the previous same-phase entry lacks failedEvaluations", () => {
    const issueLog = {
      entries: [
        { step: "impl-gate", phase, reason: "legacy entry" },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "g", result: "fail", reason: "anything" },
    ];
    assertNoRepeatedFail({ issueLog, phase, currentEvaluations });
  });

  it("does not throw when phases do not match (REQ-5)", () => {
    const issueLog = {
      entries: [
        {
          step: "gate-integration",
          phase: "integration",
          failedEvaluations: [{ guardrail_id: "g", reason: "r" }],
        },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "g", result: "fail", reason: "r" },
    ];
    assertNoRepeatedFail({ issueLog, phase: "task-impl", currentEvaluations });
  });

  it("does not throw when current evaluation has no FAIL entries", () => {
    const issueLog = {
      entries: [
        {
          step: "impl-gate",
          phase,
          failedEvaluations: [{ guardrail_id: "g", reason: "r" }],
        },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "g", result: "pass", reason: "r" },
    ];
    assertNoRepeatedFail({ issueLog, phase, currentEvaluations });
  });

  it("throws when at least one of multiple current FAILs matches (1-of-N)", () => {
    const issueLog = {
      entries: [
        {
          step: "impl-gate",
          phase,
          failedEvaluations: [{ guardrail_id: "g-match", reason: "same" }],
        },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "g-other", result: "fail", reason: "different" },
      { guardrail_id: "g-match", result: "fail", reason: "Same" },
    ];
    assert.throws(
      () => assertNoRepeatedFail({ issueLog, phase, currentEvaluations }),
      (err) => err.code === "ESCALATE_REPEATED_FAIL",
    );
  });
});

describe("appendIssueLogFromGateResult (REQ-4)", () => {
  const phase = "task-impl";

  it("writes failedEvaluations alongside the legacy flat reason field", () => {
    const tmp = createTmpDir();
    try {
      const specRel = "specs/0001-test/spec.json";
      const specDir = path.join(tmp, "specs/0001-test");
      fs.mkdirSync(specDir, { recursive: true });
      fs.writeFileSync(path.join(specDir, "spec.json"), "{}");

      const ctx = {
        root: tmp,
        phase,
        flowState: { spec: specRel },
        gitState: { headSha: "h", worktreeHash: "w" },
      };
      const result = {
        result: "fail",
        artifacts: {
          phase,
          level: "child",
          evaluations: [
            { guardrail_id: "g-pass", result: "pass", reason: "ok" },
            { guardrail_id: "g-fail-1", result: "fail", reason: "bad one" },
            { guardrail_id: "g-fail-2", result: "fail", reason: "bad two" },
          ],
          issues: ["bad one", "bad two"],
        },
      };

      appendIssueLogFromGateResult(ctx, result);

      const log = JSON.parse(fs.readFileSync(path.join(specDir, "issue-log.json"), "utf8"));
      assert.equal(log.entries.length, 1);
      const entry = log.entries[0];
      assert.equal(entry.phase, phase);
      assert.equal(typeof entry.reason, "string");
      assert.match(entry.reason, /bad one/);
      assert.deepEqual(entry.failedEvaluations, [
        { guardrail_id: "g-fail-1", reason: "bad one" },
        { guardrail_id: "g-fail-2", reason: "bad two" },
      ]);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("omits failedEvaluations when no FAIL evaluations are present", () => {
    const tmp = createTmpDir();
    try {
      const specRel = "specs/0001-test/spec.json";
      const specDir = path.join(tmp, "specs/0001-test");
      fs.mkdirSync(specDir, { recursive: true });
      fs.writeFileSync(path.join(specDir, "spec.json"), "{}");

      const ctx = { root: tmp, phase, flowState: { spec: specRel } };
      const result = {
        result: "fail",
        artifacts: {
          phase,
          level: "child",
          evaluations: [],
          issues: ["structural issue"],
        },
      };

      appendIssueLogFromGateResult(ctx, result);

      const log = JSON.parse(fs.readFileSync(path.join(specDir, "issue-log.json"), "utf8"));
      assert.equal(log.entries.length, 1);
      const entry = log.entries[0];
      assert.ok(!("failedEvaluations" in entry) || entry.failedEvaluations.length === 0);
    } finally {
      removeTmpDir(tmp);
    }
  });
});
