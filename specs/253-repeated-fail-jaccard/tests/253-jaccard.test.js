// spec: R1 R2 R3 R4 R5 R6 R7 R10
import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import {
  normalize,
  jaccard,
  findPreviousFailedEvaluations,
  assertNoRepeatedFail,
} from "../../../src/flow/lib/run-gate.js";

// ---------------------------------------------------------------------------
// R1: normalize(text) -> Set<string>
// ASCII lowercase, replace [^\w\s-] with space, split /\s+/, length>=2 with
// at least one word-char, strip Tier1 STOPWORDS (30 words).
// ---------------------------------------------------------------------------

describe("R1: normalize", () => {
  test("R1: basic lowercase and punctuation handling", () => {
    const s = normalize("Hello, World!");
    assert.deepEqual([...s].sort(), ["hello", "world"]);
  });

  test("R1: hyphen preserved inside token, slash splits", () => {
    const s = normalize("REQ-7/REQ-8");
    assert.deepEqual([...s].sort(), ["req-7", "req-8"]);
    const t = normalize("foo-bar baz");
    assert.deepEqual([...t].sort(), ["baz", "foo-bar"]);
  });

  test("R1: punctuation-only tokens are excluded", () => {
    const s = normalize("---");
    assert.equal(s.size, 0);
    const t = normalize(". , ; :");
    assert.equal(t.size, 0);
  });

  test("R1: nullish and empty inputs return empty Set", () => {
    assert.equal(normalize("").size, 0);
    assert.equal(normalize(null).size, 0);
    assert.equal(normalize(undefined).size, 0);
  });

  test("R1: stopwords are excluded", () => {
    const s = normalize("the quick brown fox is in the box");
    // 'the', 'is', 'in' are stopwords → excluded
    assert.deepEqual([...s].sort(), ["box", "brown", "fox", "quick"]);
  });

  test("R1: short tokens (length<2) are excluded", () => {
    const s = normalize("a b cd ef");
    // 'a', 'b' length<2; 'cd', 'ef' kept (not stopwords)
    assert.deepEqual([...s].sort(), ["cd", "ef"]);
  });

  test("R1: meaning-bearing words like must/shall/without/not are kept", () => {
    const s = normalize("must shall without not no");
    assert.deepEqual([...s].sort(), ["must", "no", "not", "shall", "without"]);
  });
});

// ---------------------------------------------------------------------------
// R2: jaccard(a, b) -> number (raw float). Empty-set returns 0.
// ---------------------------------------------------------------------------

describe("R2: jaccard", () => {
  test("R2: identical sets return 1", () => {
    assert.equal(jaccard(new Set(["a", "b"]), new Set(["a", "b"])), 1);
  });

  test("R2: disjoint non-empty sets return 0", () => {
    assert.equal(jaccard(new Set(["a", "b"]), new Set(["c", "d"])), 0);
  });

  test("R2: partial overlap returns intersection / union", () => {
    // {ab, bb} vs {ab, cc}: intersect=1, union=3 → 1/3
    const v = jaccard(new Set(["ab", "bb"]), new Set(["ab", "cc"]));
    assert.ok(Math.abs(v - 1 / 3) < 1e-9);
  });

  test("R2: both empty sets return 0 (intentional deviation from issue pseudocode)", () => {
    assert.equal(jaccard(new Set(), new Set()), 0);
  });

  test("R2: one empty set returns 0", () => {
    assert.equal(jaccard(new Set(["a"]), new Set()), 0);
    assert.equal(jaccard(new Set(), new Set(["a"])), 0);
  });

  test("R2: returns raw float (no rounding)", () => {
    // 3 word common out of 4 union = 3/4 = 0.75
    const v = jaccard(new Set(["xx", "yy", "zz"]), new Set(["xx", "yy", "zz", "ww"]));
    assert.equal(v, 0.75);
  });
});

// ---------------------------------------------------------------------------
// R3: JACCARD_THRESHOLD = 0.5 (internal constant). Tests assert spec contract
// value 0.5 directly via behavior, not by importing the constant.
// ---------------------------------------------------------------------------

describe("R3: JACCARD_THRESHOLD contract value 0.5", () => {
  test("R3: similarity exactly 0.5 escalates (boundary inclusive)", () => {
    // Pick token sets where jaccard = 0.5: 3 vs 3 with 2 common -> 2/4 = 0.5
    // current: "alpha beta gamma" -> normalize → {alpha, beta, gamma} (length>=2, no stopwords)
    // prior:   "alpha beta delta" -> {alpha, beta, delta}
    // intersect = {alpha, beta} = 2, union = {alpha, beta, gamma, delta} = 4
    // jaccard = 2/4 = 0.5 → escalate
    const issueLog = {
      entries: [
        {
          step: "gate-spec",
          phase: "spec",
          failedEvaluations: [
            { guardrail_id: "g1", reason: "alpha beta delta" },
          ],
        },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "g1", result: "fail", reason: "alpha beta gamma" },
    ];
    assert.throws(
      () => assertNoRepeatedFail({ issueLog, phase: "spec", currentEvaluations }),
      (err) => err.code === "ESCALATE_REPEATED_FAIL",
    );
  });

  test("R3: similarity below 0.5 does not escalate", () => {
    // 3 vs 3 with 1 common -> 1/5 = 0.2 < 0.5
    const issueLog = {
      entries: [
        {
          step: "gate-spec",
          phase: "spec",
          failedEvaluations: [
            { guardrail_id: "g1", reason: "alpha foo bar" },
          ],
        },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "g1", result: "fail", reason: "alpha xxx yyy" },
    ];
    // Should NOT throw
    assertNoRepeatedFail({ issueLog, phase: "spec", currentEvaluations });
  });
});

// ---------------------------------------------------------------------------
// R4: findPreviousFailedEvaluations({issueLog, phase}) flattens all prior
// same-phase entries' failedEvaluations in chronological order. Returns []
// when no match.
// ---------------------------------------------------------------------------

describe("R4: findPreviousFailedEvaluations flatten + empty array", () => {
  test("R4: flattens all matching same-phase entries in entry order", () => {
    const issueLog = {
      entries: [
        {
          phase: "spec",
          failedEvaluations: [{ guardrail_id: "g1", reason: "first" }],
        },
        {
          phase: "draft",
          failedEvaluations: [{ guardrail_id: "g1", reason: "draft-first" }],
        },
        {
          phase: "spec",
          failedEvaluations: [
            { guardrail_id: "g1", reason: "second" },
            { guardrail_id: "g2", reason: "third" },
          ],
        },
      ],
    };
    const result = findPreviousFailedEvaluations({ issueLog, phase: "spec" });
    assert.deepEqual(
      result.map((r) => r.reason),
      ["first", "second", "third"],
    );
  });

  test("R4: skips entries with empty or absent failedEvaluations", () => {
    const issueLog = {
      entries: [
        { phase: "spec" },
        { phase: "spec", failedEvaluations: [] },
        {
          phase: "spec",
          failedEvaluations: [{ guardrail_id: "g1", reason: "kept" }],
        },
      ],
    };
    const result = findPreviousFailedEvaluations({ issueLog, phase: "spec" });
    assert.deepEqual(
      result.map((r) => r.reason),
      ["kept"],
    );
  });

  test("R4: returns empty array on no match (null issueLog)", () => {
    assert.deepEqual(findPreviousFailedEvaluations({ issueLog: null, phase: "spec" }), []);
    assert.deepEqual(findPreviousFailedEvaluations({ issueLog: undefined, phase: "spec" }), []);
  });

  test("R4: returns empty array when no same-phase entries", () => {
    const issueLog = {
      entries: [
        { phase: "draft", failedEvaluations: [{ guardrail_id: "g1", reason: "x" }] },
      ],
    };
    assert.deepEqual(findPreviousFailedEvaluations({ issueLog, phase: "spec" }), []);
  });

  test("R4: returns empty array when all entries are legacy/empty", () => {
    const issueLog = {
      entries: [
        { phase: "spec" },
        { phase: "spec", failedEvaluations: [] },
      ],
    };
    assert.deepEqual(findPreviousFailedEvaluations({ issueLog, phase: "spec" }), []);
  });
});

// ---------------------------------------------------------------------------
// R5: assertNoRepeatedFail max-match per current FAIL, escalate at >= 0.5,
// guardrail_id AND condition, RETRY_TRACKED_PHASES gate, deterministic tie-break.
// ---------------------------------------------------------------------------

describe("R5: assertNoRepeatedFail behavior", () => {
  test("R5: throws ESCALATE_REPEATED_FAIL on high similarity match", () => {
    const issueLog = {
      entries: [
        {
          phase: "spec",
          failedEvaluations: [
            { guardrail_id: "g1", reason: "alpha beta gamma delta epsilon" },
          ],
        },
      ],
    };
    const currentEvaluations = [
      // alpha beta gamma delta zeta vs above: intersect=4, union=6 → 4/6 ≈ 0.667
      { guardrail_id: "g1", result: "fail", reason: "alpha beta gamma delta zeta" },
    ];
    assert.throws(
      () => assertNoRepeatedFail({ issueLog, phase: "spec", currentEvaluations }),
      (err) => {
        assert.equal(err.code, "ESCALATE_REPEATED_FAIL");
        assert.equal(err.data.phase, "spec");
        assert.ok(Array.isArray(err.data.matched));
        assert.equal(err.data.matched.length, 1);
        assert.equal(err.data.matched[0].guardrail_id, "g1");
        assert.equal(err.data.matched[0].currentReason, "alpha beta gamma delta zeta");
        assert.equal(err.data.matched[0].priorReason, "alpha beta gamma delta epsilon");
        assert.ok(err.data.matched[0].similarity >= 0.5);
        return true;
      },
    );
  });

  test("R5: does not throw when guardrail_id mismatches even on identical wording", () => {
    const issueLog = {
      entries: [
        {
          phase: "spec",
          failedEvaluations: [
            { guardrail_id: "g1", reason: "alpha beta gamma" },
          ],
        },
      ],
    };
    const currentEvaluations = [
      // identical reason but different guardrail_id
      { guardrail_id: "g2", result: "fail", reason: "alpha beta gamma" },
    ];
    // Should NOT throw
    assertNoRepeatedFail({ issueLog, phase: "spec", currentEvaluations });
  });

  test("R5: no-op when phase is outside RETRY_TRACKED_PHASES", () => {
    const issueLog = {
      entries: [
        {
          phase: "unknown-phase",
          failedEvaluations: [{ guardrail_id: "g1", reason: "alpha beta gamma" }],
        },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "g1", result: "fail", reason: "alpha beta gamma" },
    ];
    const r = assertNoRepeatedFail({ issueLog, phase: "unknown-phase", currentEvaluations });
    assert.equal(r, undefined);
  });

  test("R5: oldest prior wins on tied max similarity", () => {
    const issueLog = {
      entries: [
        {
          phase: "spec",
          failedEvaluations: [{ guardrail_id: "g1", reason: "OLDEST alpha beta gamma" }],
        },
        {
          phase: "spec",
          failedEvaluations: [{ guardrail_id: "g1", reason: "NEWEST alpha beta gamma" }],
        },
      ],
    };
    const currentEvaluations = [
      // current shares alpha beta gamma with both priors, similarity equal
      { guardrail_id: "g1", result: "fail", reason: "alpha beta gamma" },
    ];
    assert.throws(
      () => assertNoRepeatedFail({ issueLog, phase: "spec", currentEvaluations }),
      (err) => {
        assert.equal(err.code, "ESCALATE_REPEATED_FAIL");
        assert.match(err.data.matched[0].priorReason, /OLDEST/);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// R6: error message contains key information (similar/jaccard wording, phase,
// guardrail_id, similarity score).
// ---------------------------------------------------------------------------

describe("R6: escalation error message contains key information", () => {
  test("R6: message includes phase, guardrail_id, similarity and 'similar' keyword", () => {
    const issueLog = {
      entries: [
        {
          phase: "spec",
          failedEvaluations: [{ guardrail_id: "my-guardrail-id", reason: "alpha beta gamma delta" }],
        },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "my-guardrail-id", result: "fail", reason: "alpha beta gamma epsilon" },
    ];
    assert.throws(
      () => assertNoRepeatedFail({ issueLog, phase: "spec", currentEvaluations }),
      (err) => {
        const msg = err.message;
        // key substrings: phase string, guardrail_id, 'similar' keyword
        assert.ok(msg.includes("spec"), `message must include phase: ${msg}`);
        assert.ok(msg.includes("my-guardrail-id"), `message must include guardrail_id: ${msg}`);
        assert.ok(/similar/i.test(msg), `message must include 'similar' keyword: ${msg}`);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// R7: obsolete normalizeReason / buildFailPairKey are removed (not exported).
// ---------------------------------------------------------------------------

describe("R7: obsolete functions removed", () => {
  test("R7: normalizeReason is no longer exported", async () => {
    const mod = await import("../../../src/flow/lib/run-gate.js");
    assert.equal(typeof mod.normalizeReason, "undefined");
  });

  test("R7: buildFailPairKey is no longer exported", async () => {
    const mod = await import("../../../src/flow/lib/run-gate.js");
    assert.equal(typeof mod.buildFailPairKey, "undefined");
  });
});

// ---------------------------------------------------------------------------
// R10: synthetic high/low/boundary fixture tests verify threshold 0.5 works.
// ---------------------------------------------------------------------------

describe("R10: synthetic similarity fixtures around threshold 0.5", () => {
  test("R10: high-similarity reworded reasons escalate", () => {
    const issueLog = {
      entries: [
        {
          phase: "spec",
          failedEvaluations: [
            { guardrail_id: "g1", reason: "Spec mandates deleting tests without user approval" },
          ],
        },
        {
          phase: "spec",
          failedEvaluations: [
            { guardrail_id: "g1", reason: "Spec mandates deleting related tests without user approval" },
          ],
        },
      ],
    };
    const currentEvaluations = [
      {
        guardrail_id: "g1",
        result: "fail",
        reason: "Spec mandates deletion of tests without explicit user approval",
      },
    ];
    assert.throws(
      () => assertNoRepeatedFail({ issueLog, phase: "spec", currentEvaluations }),
      (err) => err.code === "ESCALATE_REPEATED_FAIL",
    );
  });

  test("R10: low-similarity unrelated reasons do not escalate", () => {
    const issueLog = {
      entries: [
        {
          phase: "spec",
          failedEvaluations: [
            { guardrail_id: "g1", reason: "Missing required field in schema definition" },
          ],
        },
        {
          phase: "spec",
          failedEvaluations: [
            { guardrail_id: "g1", reason: "Unauthorized API access detected during request" },
          ],
        },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "g1", result: "fail", reason: "Database migration failed during rollback" },
    ];
    // Should NOT throw
    assertNoRepeatedFail({ issueLog, phase: "spec", currentEvaluations });
  });

  test("R10: boundary jaccard exactly 0.5 escalates (>= boundary inclusive)", () => {
    // Same construction as R3 boundary test: 3 vs 3 with 2 common → 2/4 = 0.5
    const issueLog = {
      entries: [
        {
          phase: "spec",
          failedEvaluations: [
            { guardrail_id: "gx", reason: "alpha beta delta" },
          ],
        },
      ],
    };
    const currentEvaluations = [
      { guardrail_id: "gx", result: "fail", reason: "alpha beta gamma" },
    ];
    assert.throws(
      () => assertNoRepeatedFail({ issueLog, phase: "spec", currentEvaluations }),
      (err) => err.code === "ESCALATE_REPEATED_FAIL",
    );
  });
});
