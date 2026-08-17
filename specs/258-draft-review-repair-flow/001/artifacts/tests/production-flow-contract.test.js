// spec: R11
//
// Production-facing coverage for the draft review split. This file avoids
// test-only routers and validators: each assertion calls implementation code
// from src/flow directly.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { buildDraftReviewArtifact } from "../../../src/flow/commands/review.js";
import { draftReviewRouteForKey } from "../../../src/flow/lib/draft-review-routes.js";
import { validateDraftReviewArtifactSet } from "../../../src/flow/lib/run-gate.js";
import { resolveDraftReviewNextStep } from "../../../src/flow/lib/run-review.js";
import { repairItem, reviewItem, triageItem } from "./helpers/artifacts.js";

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function writeJson(dir, filename, value) {
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(value, null, 2) + "\n");
}

function writeArtifactSet(dir, route, overrides = {}) {
  writeJson(dir, route.reviewArtifact, {
    version: 1,
    phase: route.reviewStepId,
    sourceDraft: "draft.json",
    generatedAt: "2026-05-18T00:00:00.000Z",
    verdict: "FAIL",
    summary: "one production finding",
    blockingFindings: [reviewItem("Q1", "blocking")],
    advisoryFindings: [],
    repairTargets: [],
    ...overrides.review,
  });
  writeJson(dir, route.triageArtifact, {
    version: 1,
    phase: route.triageStepId,
    sourceReview: route.reviewArtifact,
    summary: "production triage",
    items: [triageItem("Q1", "apply")],
    ...overrides.triage,
  });
  writeJson(dir, route.repairArtifact, {
    version: 1,
    phase: route.repairStepId,
    sourceTriage: route.triageArtifact,
    summary: "production repair",
    items: [repairItem("Q1")],
    ...overrides.repair,
  });
}

describe("production draft review split coverage", () => {
  it("review artifact production leaves draft.json and repair audit files untouched", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "draft-review-prod-"));
    try {
      const draftPath = path.join(tmp, "draft.json");
      fs.writeFileSync(draftPath, JSON.stringify({
        goal: "Keep this draft stable.",
        qa: [{ id: "q1", question: "Q?", answer: "A" }],
        approval: { approved: false },
      }, null, 2) + "\n");
      const before = hashFile(draftPath);

      const artifact = buildDraftReviewArtifact({
        raw: "production artifact test",
        draftPath,
        stage: {
          reviewPhase: "review-draft-questions",
          findingClassification: "blocking",
        },
        proposals: [{
          title: "Split question",
          file: null,
          body: [
            "**QA:** q1",
            "**Classification:** blocking",
            "**Issue:** The question is ambiguous.",
            "**Why it matters:** It blocks the draft.",
            "**Suggested question:** Ask one decision.",
          ].join("\n"),
        }],
      });

      assert.equal(hashFile(draftPath), before);
      assert.equal(fs.existsSync(path.join(tmp, "draft-questions-repair.json")), false);
      assert.equal(artifact.verdict, "FAIL");
      assert.equal(artifact.blockingFindings.length, 1);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("production gate validator accepts linked review, triage, and repair artifacts", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "draft-gate-prod-"));
    try {
      const route = draftReviewRouteForKey("questions");
      writeArtifactSet(tmp, route);
      assert.deepEqual(validateDraftReviewArtifactSet(tmp, route).issues, []);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("production gate validator rejects unresolved triage decisions", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "draft-gate-prod-"));
    try {
      const route = draftReviewRouteForKey("questions");
      writeArtifactSet(tmp, route, {
        triage: { items: [triageItem("Q1", "requires_user_decision")] },
        repair: { items: [] },
      });
      const result = validateDraftReviewArtifactSet(tmp, route);
      assert.ok(
        result.issues.some((issue) => /requires user decision/.test(issue)),
        `expected unresolved decision issue; got ${JSON.stringify(result.issues)}`,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("production router distinguishes PASS, ADVISORY, and FAIL", () => {
    assert.equal(
      resolveDraftReviewNextStep({ verdict: "PASS", retryPhase: "draft-coverage" }),
      "gate-draft",
    );
    assert.equal(
      resolveDraftReviewNextStep({ verdict: "ADVISORY", retryPhase: "draft-coverage" }),
      "draft-coverage-triage",
    );
    assert.equal(
      resolveDraftReviewNextStep({ verdict: "FAIL", retryPhase: "draft-questions" }),
      "draft-questions-triage",
    );
  });
});
