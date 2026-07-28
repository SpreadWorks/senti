import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { runImplReview } from "../../../src/flow/commands/review.js";
import {
  buildRepairFingerprint,
  prepareImplTriageArtifact,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import { evaluateReviewFindingGateReadiness } from "../../../src/flow/lib/run-gate.js";
import SetIssueLogCommand, { loadIssueLog } from "../../../src/flow/lib/set-issue-log.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

test("integration finding gate rejects an issue-log repair claim without bound review evidence", async () => {
  const root = createTmpDir("finding-gate-readiness-");
  try {
    const specPath = "specs/demo/spec.json";
    fs.mkdirSync(path.join(root, "specs/demo"), { recursive: true });
    fs.writeFileSync(path.join(root, specPath), `${JSON.stringify({
      requirements: [{ id: "R1", priority: "must", desc: "Persist typed review findings." }],
    }, null, 2)}\n`);
    await runImplReview({
      root,
      flow: { spec: specPath },
      touchedFiles: new Set(),
      reviewOutput: JSON.stringify({
        blockingFindings: [{
          findingKey: "missing-typed-artifact",
          title: "Missing typed artifact",
          failureMode: "missing_acceptance_requirement",
          file: null,
          requirementId: "R1",
          issue: "The typed review artifact is missing.",
          suggestion: "Write the typed artifact.",
          disposition: "must-fix",
          rationale: "R1 makes this artifact mandatory.",
        }],
        nonBlockingImprovements: [],
      }),
    });
    const state = { spec: specPath, currentTaskId: null };
    const missing = evaluateReviewFindingGateReadiness({
      root,
      state,
      phase: "integration",
      issueLog: { entries: [] },
    });
    assert.equal(missing.decision.allowsPass(), false);

    const findingId = missing.artifact.blockingFindings[0].findingId;
    fs.mkdirSync(path.join(root, "src/flow/lib"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/flow/lib/run-gate.js"), "export {};\n");
    const recorded = new SetIssueLogCommand().execute({
      root,
      flowState: state,
      step: "impl-review",
      reason: "Implemented the mandatory typed review artifact.",
      resolution: "The finding now has matching file evidence.",
      normalizedFindingId: findingId,
      repairRefFile: "src/flow/lib/run-gate.js",
    });
    assert.equal(recorded.entry.normalizedFindingId, findingId);

    fs.utimesSync(
      path.join(root, "src/flow/lib/run-gate.js"),
      new Date("2000-01-01T00:00:00.000Z"),
      new Date("2000-01-01T00:00:00.000Z"),
    );
    const staleMaterial = evaluateReviewFindingGateReadiness({
      root,
      state,
      phase: "integration",
      issueLog: loadIssueLog(root, specPath),
    });
    assert.equal(staleMaterial.decision.allowsPass(), false);

    fs.rmSync(path.join(root, "src/flow/lib/run-gate.js"));
    const phantom = evaluateReviewFindingGateReadiness({
      root,
      state,
      phase: "integration",
      issueLog: loadIssueLog(root, specPath),
    });
    assert.equal(phantom.decision.allowsPass(), false);
    fs.writeFileSync(path.join(root, "src/flow/lib/run-gate.js"), "export {};\n");

    const repaired = evaluateReviewFindingGateReadiness({
      root,
      state,
      phase: "integration",
      issueLog: loadIssueLog(root, specPath),
    });
    assert.equal(repaired.decision.allowsPass(), false);
  } finally {
    removeTmpDir(root);
  }
});

test("integration finding gate honors an all-reject implementation triage", async () => {
  const root = createTmpDir("finding-gate-rejected-triage-");
  try {
    const specPath = "specs/demo/spec.json";
    const specDir = path.join(root, "specs/demo");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(root, specPath), `${JSON.stringify({
      requirements: [{ id: "R1", priority: "must", desc: "Persist typed review findings." }],
    }, null, 2)}\n`);
    await runImplReview({
      root,
      flow: { spec: specPath },
      touchedFiles: new Set(["src/example.js"]),
      reviewOutput: JSON.stringify({
        blockingFindings: [{
          findingKey: "rejected-by-triage",
          title: "Rejected finding",
          failureMode: "spec_behavior_contradiction",
          file: "src/example.js",
          requirementId: "R1",
          issue: "The review proposal contradicts the accepted requirement.",
          suggestion: "Restore the obsolete behavior.",
          disposition: "must-fix",
          rationale: "The reviewer classified it as mandatory.",
        }],
        nonBlockingImprovements: [],
      }),
    });
    const review = JSON.parse(fs.readFileSync(path.join(specDir, "impl-review.json"), "utf8"));
    const fingerprint = buildRepairFingerprint({ root, specPath, state: { spec: specPath } });
    assert.equal(review.repairFingerprint, fingerprint.hash);
    prepareImplTriageArtifact({
      specDir,
      sourceStep: "impl-review",
      sourceArtifact: "impl-review.json",
      findings: review.blockingFindings.map((finding) => ({ ...finding, decision: "reject" })),
      fingerprint,
    });

    const readiness = evaluateReviewFindingGateReadiness({
      root,
      state: { spec: specPath, currentTaskId: null },
      phase: "integration",
      issueLog: { entries: [] },
    });

    assert.equal(readiness.artifact.verdict, "REJECTED");
    assert.equal(readiness.decision.allowsPass(), true);
  } finally {
    removeTmpDir(root);
  }
});

test("finding gate retains unresolved must-fix obligations from review history", async () => {
  const root = createTmpDir("finding-gate-history-");
  try {
    const specPath = "specs/demo/spec.json";
    fs.mkdirSync(path.join(root, "specs/demo"), { recursive: true });
    fs.writeFileSync(path.join(root, specPath), `${JSON.stringify({
      requirements: [{ id: "R1", priority: "must", desc: "Persist typed review findings." }],
    }, null, 2)}\n`);
    await runImplReview({
      root,
      flow: { spec: specPath },
      touchedFiles: new Set(),
      reviewOutput: JSON.stringify({
        blockingFindings: [{
          findingKey: "missing-typed-artifact",
          title: "Missing typed artifact",
          failureMode: "missing_acceptance_requirement",
          file: null,
          requirementId: "R1",
          issue: "The typed review artifact is missing.",
          suggestion: "Write the typed artifact.",
          disposition: "must-fix",
          rationale: "R1 makes this artifact mandatory.",
        }],
        nonBlockingImprovements: [],
      }),
    });
    await runImplReview({
      root,
      flow: { spec: specPath },
      touchedFiles: new Set(),
      reviewOutput: JSON.stringify({ blockingFindings: [], nonBlockingImprovements: [] }),
    });

    const readiness = evaluateReviewFindingGateReadiness({
      root,
      state: { spec: specPath, currentTaskId: null },
      phase: "integration",
      issueLog: { entries: [] },
    });
    assert.equal(readiness.artifact.verdict, "PASS");
    assert.equal(readiness.decision.allowsPass(), false);
    assert.match(readiness.decision.issues[0], /missing matching repair evidence/);

    fs.rmSync(path.join(root, "specs/demo/impl-review.json"));
    assert.throws(
      () => evaluateReviewFindingGateReadiness({
        root,
        state: { spec: specPath, currentTaskId: null },
        phase: "integration",
        issueLog: { entries: [] },
      }),
      /review artifact is missing/,
    );
  } finally {
    removeTmpDir(root);
  }
});

test("finding gate supersedes historical obligations after review evidence changes", async () => {
  const root = createTmpDir("finding-gate-fresh-review-");
  try {
    const specPath = "specs/demo/spec.json";
    fs.mkdirSync(path.join(root, "specs/demo"), { recursive: true });
    fs.writeFileSync(path.join(root, specPath), `${JSON.stringify({
      requirements: [{ id: "R1", priority: "must", desc: "Persist typed review findings." }],
    }, null, 2)}\n`);
    await runImplReview({
      root,
      flow: { spec: specPath },
      touchedFiles: new Set(),
      reviewOutput: JSON.stringify({
        blockingFindings: [{
          findingKey: "missing-typed-artifact",
          title: "Missing typed artifact",
          failureMode: "missing_acceptance_requirement",
          file: null,
          requirementId: "R1",
          issue: "The typed review artifact is missing.",
          suggestion: "Write the typed artifact.",
          disposition: "must-fix",
          rationale: "R1 makes this artifact mandatory.",
        }],
        nonBlockingImprovements: [],
      }),
    });
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "reviewed-change.js"), "export const reviewed = true;\n");
    await runImplReview({
      root,
      flow: { spec: specPath },
      touchedFiles: new Set(),
      reviewOutput: JSON.stringify({ blockingFindings: [], nonBlockingImprovements: [] }),
    });

    const readiness = evaluateReviewFindingGateReadiness({
      root,
      state: { spec: specPath, currentTaskId: null },
      phase: "integration",
      issueLog: { entries: [] },
    });
    assert.equal(readiness.artifact.verdict, "PASS");
    assert.equal(readiness.decision.allowsPass(), true);

    const historyDir = path.join(root, "specs/demo/review-history");
    const originalReviewPath = path.join(historyDir, "impl-attempt-001.json");
    const legacyReview = JSON.parse(fs.readFileSync(originalReviewPath, "utf8"));
    delete legacyReview.repairFingerprint;
    fs.writeFileSync(originalReviewPath, `${JSON.stringify(legacyReview)}\n`);

    const legacyReadiness = evaluateReviewFindingGateReadiness({
      root,
      state: { spec: specPath, currentTaskId: null },
      phase: "integration",
      issueLog: { entries: [] },
    });
    assert.equal(legacyReadiness.decision.allowsPass(), false);
  } finally {
    removeTmpDir(root);
  }
});

test("finding gate ignores legacy advisory-only history with stale finding identities", async () => {
  const root = createTmpDir("finding-gate-legacy-advisory-");
  try {
    const specPath = "specs/demo/spec.json";
    fs.mkdirSync(path.join(root, "specs/demo"), { recursive: true });
    fs.writeFileSync(path.join(root, specPath), `${JSON.stringify({
      requirements: [{ id: "R1", priority: "should", desc: "Keep review history readable." }],
    })}\n`);
    await runImplReview({
      root,
      flow: { spec: specPath },
      touchedFiles: new Set(["src/example.js"]),
      reviewOutput: JSON.stringify({
        blockingFindings: [],
        nonBlockingImprovements: [{
          findingKey: "legacy-advisory",
          title: "Legacy advisory",
          failureMode: "refactor",
          file: "src/example.js",
          requirementId: "R1",
          issue: "Historical advice.",
          suggestion: "No action required.",
          disposition: "informational",
          rationale: "This does not block the requirement.",
        }],
      }),
    });
    const historyDir = path.join(root, "specs/demo/review-history");
    fs.mkdirSync(historyDir, { recursive: true });
    const historyPath = path.join(historyDir, "impl-attempt-001.json");
    const history = JSON.parse(fs.readFileSync(path.join(root, "specs/demo/impl-review.json"), "utf8"));
    history.nonBlockingImprovements[0].findingId = "0".repeat(64);
    history.nonBlockingImprovements[0].fingerprint = "0".repeat(64);
    fs.writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`);
    await runImplReview({
      root,
      flow: { spec: specPath },
      touchedFiles: new Set(),
      reviewOutput: JSON.stringify({ blockingFindings: [], nonBlockingImprovements: [] }),
    });

    const readiness = evaluateReviewFindingGateReadiness({
      root,
      state: { spec: specPath, currentTaskId: null },
      phase: "integration",
      issueLog: { entries: [] },
    });
    assert.equal(readiness.artifact.verdict, "PASS");
    assert.equal(readiness.decision.allowsPass(), true);
  } finally {
    removeTmpDir(root);
  }
});

test("finding gate fails closed for a missing or malformed review artifact", () => {
  const root = createTmpDir("finding-gate-malformed-");
  try {
    const specPath = "specs/demo/spec.json";
    fs.mkdirSync(path.join(root, "specs/demo"), { recursive: true });
    fs.writeFileSync(path.join(root, specPath), `${JSON.stringify({ requirements: [] })}\n`);
    assert.throws(
      () => evaluateReviewFindingGateReadiness({ root, state: { spec: specPath }, phase: "integration" }),
      /review artifact is missing/,
    );
    fs.writeFileSync(path.join(root, "specs/demo/impl-review.json"), "{}\n");
    assert.throws(
      () => evaluateReviewFindingGateReadiness({ root, state: { spec: specPath }, phase: "integration" }),
      /version must be 1/,
    );
  } finally {
    removeTmpDir(root);
  }
});

test("finding gate ignores obligations from an earlier run", async () => {
  const root = createTmpDir("finding-gate-run-cycle-");
  try {
    const specPath = "specs/demo/spec.json";
    fs.mkdirSync(path.join(root, "specs/demo"), { recursive: true });
    fs.writeFileSync(path.join(root, specPath), `${JSON.stringify({
      requirements: [{ id: "R1", priority: "must", desc: "Implement R1." }],
    })}\n`);
    await runImplReview({
      root,
      flow: { spec: specPath, runId: "run-old" },
      touchedFiles: new Set(),
      reviewOutput: JSON.stringify({
        blockingFindings: [{
          findingKey: "r1-missing",
          title: "R1 is missing",
          failureMode: "missing_acceptance_requirement",
          file: null,
          requirementId: "R1",
          issue: "R1 is absent.",
          suggestion: "Implement R1.",
          disposition: "must-fix",
          rationale: "R1 is mandatory.",
        }],
        nonBlockingImprovements: [],
      }),
    });
    await runImplReview({
      root,
      flow: { spec: specPath, runId: "run-new" },
      touchedFiles: new Set(),
      reviewOutput: JSON.stringify({ blockingFindings: [], nonBlockingImprovements: [] }),
    });

    const readiness = evaluateReviewFindingGateReadiness({
      root,
      state: { spec: specPath, runId: "run-new" },
      phase: "integration",
      issueLog: { entries: [] },
    });
    assert.equal(readiness.artifact.verdict, "PASS");
    assert.equal(readiness.decision.allowsPass(), true);
  } finally {
    removeTmpDir(root);
  }
});

test("plan rewind starts a fresh fingerprint retry count", async () => {
  const root = createTmpDir("finding-gate-rewind-cycle-");
  try {
    const specPath = "specs/demo/spec.json";
    fs.mkdirSync(path.join(root, "specs/demo"), { recursive: true });
    fs.writeFileSync(path.join(root, specPath), `${JSON.stringify({
      requirements: [{ id: "R1", priority: "must", desc: "Implement R1." }],
    })}\n`);
    const reviewOutput = JSON.stringify({
      blockingFindings: [{
        findingKey: "r1-missing",
        title: "R1 is missing",
        failureMode: "missing_acceptance_requirement",
        file: null,
        requirementId: "R1",
        issue: "R1 is absent.",
        suggestion: "Implement R1.",
        disposition: "must-fix",
        rationale: "R1 is mandatory.",
      }],
      nonBlockingImprovements: [],
    });
    const originalCycle = { spec: specPath, runId: "run-1" };
    await runImplReview({ root, flow: originalCycle, touchedFiles: new Set(), reviewOutput });
    await runImplReview({ root, flow: originalCycle, touchedFiles: new Set(), reviewOutput });
    await runImplReview({ root, flow: originalCycle, touchedFiles: new Set(), reviewOutput });

    const rewoundCycle = {
      spec: specPath,
      runId: "run-1",
      planRewinds: [{ rewoundAt: "2026-07-19T12:00:00.000Z" }],
    };
    await runImplReview({ root, flow: rewoundCycle, touchedFiles: new Set(), reviewOutput });
    const latest = JSON.parse(fs.readFileSync(path.join(root, "specs/demo/impl-review.json"), "utf8"));

    assert.equal(latest.planRewindAt, "2026-07-19T12:00:00.000Z");
    assert.equal(latest.blockingFindings[0].repeatCount, 1);
    assert.equal(latest.blockingFindings[0].disposition, "must-fix");
  } finally {
    removeTmpDir(root);
  }
});
