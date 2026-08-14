import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  StaleTestEvidenceMismatch,
  StaleTestEvidenceRefresh,
} from "../../../src/flow/lib/stale-test-evidence-refresh.js";

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

  it("requires the canonical Version Store for recovery", () => {
    const refresh = new StaleTestEvidenceRefresh({
      previousFingerprint: PREVIOUS,
      currentFingerprint: CURRENT,
    });

    assert.throws(() => refresh.recover({
      state: { specId: "demo" },
      flowManager: {},
      reason: "stale evidence",
    }), /canonical Version Store/);
  });

  it("delegates recovery to the typed rewind operation without mutating artifact files", () => {
    const calls = [];
    const mismatch = new StaleTestEvidenceMismatch({
      previousFingerprint: PREVIOUS,
      currentFingerprint: CURRENT,
      artifactNames: ["test.execute", "test.result.review"],
    });

    const result = mismatch.recover({
      state: { schemaRevision: 3, specId: "demo" },
      flowManager: {
        rewindTestEvidence(input) { calls.push(input); },
      },
      reason: "post-gate implementation changed",
      sourceStep: "retro",
    });

    assert.deepEqual(calls, [{
      specId: "demo",
      reason: "post-gate implementation changed",
      sourceStep: "retro",
    }]);
    assert.deepEqual(result.toJSON(), {
      recovered: true,
      previousFingerprint: PREVIOUS,
      currentFingerprint: CURRENT,
      invalidatedArtifacts: ["test.execute", "test.result.review"],
      invalidations: [],
      activeStep: "test-execute",
    });
  });
});
