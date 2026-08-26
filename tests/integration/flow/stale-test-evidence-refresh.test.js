import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { StaleTestEvidenceMismatch } from "../../../src/flow/lib/stale-test-evidence-refresh.js";

const PREVIOUS = "a".repeat(64);
const CURRENT = "b".repeat(64);

describe("canonical stale test evidence refresh", () => {
  it("detects one stale fingerprint across cataloged producer artifacts", () => {
    const mismatch = StaleTestEvidenceMismatch.detect({
      artifacts: new Map([
        ["test.execute", { repairFingerprint: PREVIOUS }],
        ["test.result.review", { repairFingerprint: PREVIOUS }],
        ["unversioned", { verdict: "pass" }],
      ]),
      currentFingerprint: CURRENT,
    });

    assert.equal(mismatch.previousFingerprint, PREVIOUS);
    assert.equal(mismatch.currentFingerprint, CURRENT);
    assert.deepEqual(mismatch.artifactNames, ["test.execute", "test.result.review"]);
  });

  it("returns null when every cataloged fingerprint matches current authority", () => {
    assert.equal(StaleTestEvidenceMismatch.detect({
      artifacts: new Map([["test.execute", { repairFingerprint: CURRENT }]]),
      currentFingerprint: CURRENT,
    }), null);
  });

  it("fails closed when stale artifacts disagree about their source fingerprint", () => {
    assert.throws(() => StaleTestEvidenceMismatch.detect({
      artifacts: new Map([
        ["test.execute", { repairFingerprint: PREVIOUS }],
        ["test.result.review", { repairFingerprint: "c".repeat(64) }],
      ]),
      currentFingerprint: CURRENT,
    }), /inconsistent repair fingerprints/);
  });
});
