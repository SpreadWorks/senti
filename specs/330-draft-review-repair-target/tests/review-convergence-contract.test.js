// spec: R6 R7
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { writeReviewAttemptHistory } from "../../../src/flow/commands/review.js";
import {
  applyReviewEvidenceTransition,
  ReviewDisposition,
  ReviewEvidence,
  ReviewFinding,
} from "../../../src/flow/lib/review-convergence.js";
import { reviewFindingFromHistory } from "./review-fixture-helpers.js";

const REPAIR_TARGET = Object.freeze({
  title: "Empty initial QA list",
  target: "qa[]",
  rationale: "Initial QA list is empty before answer collection",
  evidence: "qa[] is empty before any answer exists",
  classification: "repair_target",
});

const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

class RecordedRepairTargetFixture {
  constructor() {
    const specDir = fs.mkdtempSync(path.join(os.tmpdir(), "issue-454-convergence-"));
    tempDirs.push(specDir);
    const artifact = {
      version: 1,
      verdict: "ADVISORY",
      blockingFindings: [],
      advisoryFindings: [],
      repairTargets: [REPAIR_TARGET],
    };
    const written = writeReviewAttemptHistory({
      specDir,
      phase: "draft-questions",
      latestBasename: "draft-review-questions.json",
      artifact,
      attemptNumber: 1,
    });
    const history = JSON.parse(fs.readFileSync(written.historyJsonPath, "utf8"));
    assert.equal(history.findings.length, 1);
    assert.equal(history.findings[0].category, "repair_target");

    const blockingFindings = [];
    const advisoryFindings = [];
    for (const finding of history.findings) {
      const canonicalFinding = reviewFindingFromHistory(
        finding,
        "draft-review-questions.json",
      );
      if (finding.severity === "blocking") {
        blockingFindings.push(canonicalFinding);
      } else if (finding.severity === "non-blocking") {
        advisoryFindings.push(canonicalFinding);
      } else {
        throw new Error(`unsupported canonical finding severity: ${finding.severity}`);
      }
    }

    this.disposition = new ReviewDisposition({
      value: artifact.verdict,
      blockingFindings,
      advisoryFindings,
    });
    Object.freeze(this);
  }

  evidence(invocationId) {
    return new ReviewEvidence({
      phase: "draft-questions",
      taskId: null,
      treeSha: "1".repeat(40),
      provenance: {
        provider: "issue-454-fixture",
        invocationId,
        capturedAt: "2026-07-23T00:00:00.000Z",
      },
      disposition: this.disposition,
    });
  }
}

function reviewFinding(id) {
  return new ReviewFinding({
    findingId: id,
    summary: `${id} summary`,
    fingerprint: crypto.createHash("sha256").update(id).digest("hex"),
    evidenceRefs: [`fixture.json#${id}`],
  });
}

test("R6: repaired advisory baseline keeps invalid disposition matrices rejected", () => {
  const baseline = new RecordedRepairTargetFixture().disposition;
  const finding = reviewFinding("matrix-finding");

  assert.equal(baseline.value, "ADVISORY");
  assert.equal(baseline.blockingFindings.length, 0);
  assert.equal(baseline.advisoryFindings.length, 1);

  assert.throws(
    () => new ReviewDisposition({
      value: "ADVISORY",
      blockingFindings: [finding],
      advisoryFindings: [],
    }),
    /ADVISORY disposition requires advisory findings and no blocking findings/,
  );
  assert.throws(
    () => new ReviewDisposition({
      value: "PASS",
      advisoryFindings: [finding],
    }),
    /PASS disposition cannot contain findings/,
  );
  assert.throws(
    () => new ReviewDisposition({
      value: "REJECTED",
      blockingFindings: [],
    }),
    /REJECTED disposition requires at least one blocking finding/,
  );
});

test("R7: repaired advisory evidence records once and rejects duplicate or completed-target reuse", () => {
  const flowState = {};
  const fixture = new RecordedRepairTargetFixture();
  const first = fixture.evidence("first");
  applyReviewEvidenceTransition(flowState, first, { configuredSemanticMaxAttempts: 4 });

  assert.throws(
    () => applyReviewEvidenceTransition(flowState, first, { configuredSemanticMaxAttempts: 4 }),
    (error) => error.code === "REVIEW_DUPLICATE_IDENTITY",
  );

  const second = fixture.evidence("second");
  assert.throws(
    () => applyReviewEvidenceTransition(flowState, second, { configuredSemanticMaxAttempts: 4 }),
    (error) => error.code === "REVIEW_ALREADY_COMPLETED",
  );
});
