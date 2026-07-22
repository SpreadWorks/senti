// spec: R2 R3 R4 R7 R8 R9
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  makeFlowManager,
  makeFlowState,
  moveFlowToStep,
} from "../../../tests/helpers/flow-setup.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const importRoot = (relPath) => import(pathToFileURL(path.join(root, relPath)).href);
const treeSha = "1".repeat(40);
const targetStateDigest = "9".repeat(64);

function providerResult(overrides = {}) {
  return {
    verdict: "ADVISORY",
    blockingFindings: [],
    advisoryFindings: [{
      findingId: "A-1",
      summary: "Non-blocking improvement.",
      fingerprint: "2".repeat(64),
      evidenceRefs: ["review.md#A-1"],
    }],
    provenance: {
      provider: "fixture-provider",
      invocationId: "fixture-001",
      capturedAt: "2026-07-22T00:00:00.000Z",
    },
    ...overrides,
  };
}

async function normalize(input) {
  const mod = await importRoot("src/flow/lib/run-review.js");
  assert.equal(typeof mod.normalizeReviewExecution, "function", "normalizeReviewExecution must be implemented");
  const { normalizeReviewExecution } = mod;
  return normalizeReviewExecution({
    phase: "impl",
    taskId: null,
    treeSha,
    ...input,
  });
}

async function pipelineModel() {
  const mod = await importRoot("src/flow/lib/run-review.js");
  assert.equal(typeof mod.ReviewExecutionPipeline, "function", "ReviewExecutionPipeline must be implemented");
  return mod.ReviewExecutionPipeline;
}

function successfulBoundaries(failingBoundary, resultOverrides = {}) {
  const fail = (boundary) => {
    if (boundary === failingBoundary) throw new Error(`${boundary} fixture failure`);
  };
  return {
    resolveCurrentTreeSha() {
      return treeSha;
    },
    resolveCurrentTargetStateDigest() {
      return targetStateDigest;
    },
    async startProvider() {
      fail("startup");
      return { invocationId: "fixture-pipeline" };
    },
    async communicate() {
      fail("communication");
      return JSON.stringify(providerResult(resultOverrides));
    },
    parseProviderResult(payload) {
      fail("parse");
      return JSON.parse(payload);
    },
    async runPostHook() {
      fail("post_hook");
    },
    async writeCanonicalEvidence(evidence) {
      fail("canonical_write");
      return evidence;
    },
    async writeProjection() {
      fail("projection");
    },
    async recordResult() {
      fail("result_recording");
    },
  };
}

function directorySnapshot(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { recursive: true })
    .filter((name) => fs.statSync(path.join(dir, name)).isFile())
    .sort()
    .map((name) => [name, fs.readFileSync(path.join(dir, name), "utf8")]);
}

function repositorySpecFixture(t, prefix) {
  const tmpRoot = path.join(root, "specs");
  fs.mkdirSync(tmpRoot, { recursive: true });
  const specDir = fs.mkdtempSync(path.join(tmpRoot, `999-${prefix}`));
  t.after(() => fs.rmSync(specDir, { recursive: true, force: true }));
  const specPath = path.join(specDir, "spec.json");
  fs.copyFileSync(
    path.join(root, "specs", "328-bounded-review-convergence", "spec.json"),
    specPath,
  );
  return {
    specDir,
    spec: path.relative(root, specPath).split(path.sep).join("/"),
  };
}

test("R3: ADVISORY with zero blocking findings is a completed review with handoff evidence", async () => {
  const result = await normalize({ providerResult: providerResult() });
  assert.equal(result.evidence.disposition.value, "ADVISORY");
  assert.equal(result.evidence.disposition.blockingFindings.length, 0);
  assert.equal(result.reviewCompleted, true);
  assert.equal(result.rerunAllowed, false);
  assert.deepEqual(result.handoffFindings.map((entry) => entry.findingId), ["A-1"]);
});

test("R9: PASS is completed once with no findings or acceptance handoff", async () => {
  const result = await normalize({
    providerResult: providerResult({
      verdict: "PASS",
      blockingFindings: [],
      advisoryFindings: [],
    }),
  });
  assert.equal(result.evidence.disposition.value, "PASS");
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.handoffFindings, []);
  assert.equal(result.reviewCompleted, true);
  assert.equal(result.rerunAllowed, false);
});

test("R4: every execution mechanism failure becomes TOOLING_ERROR without findings", async () => {
  for (const stage of ["startup", "communication", "parse", "post_hook", "canonical_write", "projection", "result_recording"]) {
    const result = await normalize({
      toolingFailure: { stage, reason: `${stage} failed`, attempt: 1, maxAttempts: 1 },
    });
    assert.equal(result.evidence, null);
    assert.equal(result.toolingOutcome.kind, "TOOLING_ERROR");
    assert.equal(result.toolingOutcome.stage, stage);
    assert.deepEqual(result.findings, []);
    assert.equal(result.semanticRetryConsumed, false);
  }
});

test("R4 R9: production execution boundaries persist bounded TOOLING_ERROR outcomes", async (t) => {
  const ReviewExecutionPipeline = await pipelineModel();
  for (const stage of ["startup", "communication", "parse", "post_hook", "canonical_write", "projection", "result_recording"]) {
    await t.test(stage, async (t) => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `senti-review-${stage}-`));
      t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
      const manager = makeFlowManager(tmp);
      manager.create(moveFlowToStep(makeFlowState({
        spec: "specs/001-review/spec.json",
        runId: `run-${stage}`,
        issue: 452,
      }), "impl-review"));
      const pipeline = new ReviewExecutionPipeline({
        flowManager: manager,
        boundaries: successfulBoundaries(stage),
      });
      const result = await pipeline.execute({
        phase: "impl",
        taskId: null,
        treeSha,
        provider: "fixture-provider",
      });

      assert.equal(result.toolingOutcome.kind, "TOOLING_ERROR");
      assert.equal(result.toolingOutcome.stage, stage);
      assert.equal(result.toolingOutcome.attempt, 1);
      assert.equal(result.toolingOutcome.maxAttempts, 2);
      assert.deepEqual(result.findings, []);
      assert.equal(result.semanticRetryConsumed, false);
      const persisted = result.convergenceState;
      assert.equal(persisted.toolingAttempts, 0);
      assert.equal(persisted.toolingMaxAttempts, 1);
      assert.equal(persisted.toolingOutcome.stage, stage);
      assert.equal(persisted.semanticAttempts, 0);
      assert.equal(
        (manager.load().metrics || []).some((entry) => entry.counter === "reviewRetry"),
        false,
      );

      const retry = await pipeline.execute({
        phase: "impl",
        taskId: null,
        treeSha,
        provider: "replacement-provider",
      });
      const expectedOperation = ["post_hook", "canonical_write", "projection", "result_recording"].includes(stage)
        ? "register_alternative_evidence"
        : "stop_as_blocker";
      if (["startup", "communication", "parse"].includes(stage)) {
        assert.equal(retry.executionStarted, true);
        assert.equal(retry.toolingOutcome.attempt, 2);
        assert.equal(retry.toolingOutcome.maxAttempts, 2);
        assert.equal(retry.nextOperation.kind, expectedOperation);
        assert.equal(retry.nextOperation.remainingToolingAttempts, 0);
        const afterRetry = Buffer.from(JSON.stringify(manager.load()));
        const refused = await pipeline.execute({
          phase: "impl",
          taskId: null,
          treeSha,
          provider: "third-provider",
        });
        assert.equal(refused.executionStarted, false);
        assert.equal(refused.nextOperation.kind, "stop_as_blocker");
        assert.deepEqual(Buffer.from(JSON.stringify(manager.load())), afterRetry);
      } else {
        assert.equal(retry.executionStarted, false);
        assert.equal(retry.nextOperation.kind, expectedOperation);
        assert.equal(retry.nextOperation.remainingToolingAttempts, 1);
      }
    });
  }
});

test("R4: projection TOOLING_ERROR does not consume REJECTED semantic remediation budget", async (t) => {
  const ReviewExecutionPipeline = await pipelineModel();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-rejected-projection-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const manager = makeFlowManager(tmp);
  manager.create(moveFlowToStep(makeFlowState({
    spec: "specs/001-review/spec.json",
    runId: "run-rejected-projection",
    issue: 452,
  }), "impl-review"));
  const result = await new ReviewExecutionPipeline({
    flowManager: manager,
    boundaries: successfulBoundaries("projection", {
      verdict: "REJECTED",
      blockingFindings: [{
        findingId: "B-1",
        summary: "Blocking finding.",
        fingerprint: "b".repeat(64),
        evidenceRefs: ["review.md#B-1"],
      }],
      advisoryFindings: [],
    }),
  }).execute({
    phase: "impl",
    taskId: null,
    treeSha,
    provider: "fixture-provider",
  });

  assert.equal(result.toolingOutcome.stage, "projection");
  assert.equal(result.convergenceState.disposition, "REJECTED");
  assert.equal(result.convergenceState.semanticAttempts, 0);
  assert.equal(result.nextOperation.kind, "register_alternative_evidence");
});

test("R2 R9: stale target tree is rejected before provider execution or persistence", async (t) => {
  const ReviewExecutionPipeline = await pipelineModel();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-stale-tree-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const manager = makeFlowManager(tmp);
  manager.create(moveFlowToStep(makeFlowState({
    spec: "specs/001-review/spec.json",
    runId: "run-stale-tree",
    issue: 452,
  }), "impl-review"));
  const boundaries = successfulBoundaries(null);
  let providerStarts = 0;
  boundaries.resolveCurrentTreeSha = () => "3".repeat(40);
  boundaries.startProvider = async () => {
    providerStarts += 1;
    return { invocationId: "must-not-start" };
  };
  const pipeline = new ReviewExecutionPipeline({ flowManager: manager, boundaries });
  const evidenceDir = path.join(tmp, "specs", "001-review", "review-evidence");
  const stateBefore = Buffer.from(JSON.stringify(manager.load()));
  const evidenceBefore = directorySnapshot(evidenceDir);

  const result = await pipeline.execute({
    phase: "impl",
    taskId: null,
    treeSha,
    provider: "fixture-provider",
  });

  assert.equal(result.executionStarted, false);
  assert.equal(result.rejection.code, "STALE_REVIEW_TARGET");
  assert.equal(providerStarts, 0);
  assert.deepEqual(Buffer.from(JSON.stringify(manager.load())), stateBefore);
  assert.deepEqual(directorySnapshot(evidenceDir), evidenceBefore);
});

test("R2 R3: completed ADVISORY identity blocks a second provider invocation without state mutation", async (t) => {
  const ReviewExecutionPipeline = await pipelineModel();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-completed-once-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const manager = makeFlowManager(tmp);
  manager.create(moveFlowToStep(makeFlowState({
    spec: "specs/001-review/spec.json",
    runId: "run-completed-once",
    issue: 452,
  }), "impl-review"));
  const boundaries = successfulBoundaries(null);
  const startProvider = boundaries.startProvider;
  let providerStarts = 0;
  boundaries.startProvider = async () => {
    providerStarts += 1;
    return startProvider();
  };
  const pipeline = new ReviewExecutionPipeline({ flowManager: manager, boundaries });
  const input = {
    phase: "impl",
    taskId: null,
    treeSha,
    provider: "fixture-provider",
  };

  const first = await pipeline.execute(input);
  assert.equal(first.reviewCompleted, true);
  assert.equal(first.evidence.disposition.value, "ADVISORY");
  assert.equal(manager.load().reviewConvergence.records[0].targetStateDigest, targetStateDigest);
  assert.equal(providerStarts, 1);
  const completedState = Buffer.from(JSON.stringify(manager.load()));

  const second = await pipeline.execute(input);
  assert.equal(second.executionStarted, false);
  assert.equal(second.rejection.code, "REVIEW_ALREADY_COMPLETED");
  assert.equal(providerStarts, 1);
  assert.deepEqual(Buffer.from(JSON.stringify(manager.load())), completedState);
});

test("R2 R7: flow run review uses the shared preflight guard before provider execution", async (t) => {
  const {
    RunReviewCommand,
  } = await importRoot("src/flow/lib/run-review.js");
  const {
    ReviewConvergenceStore,
  } = await importRoot("src/flow/lib/review-convergence.js");
  const {
    resolveCurrentReviewTreeSha,
  } = await importRoot("src/flow/lib/review-evidence-store.js");
  const {
    buildRepairFingerprint,
  } = await importRoot("src/flow/lib/impl-repair-artifacts.js");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-command-preflight-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const manager = makeFlowManager(tmp);
  manager.create(makeFlowState({
    spec: "specs/328-bounded-review-convergence/spec.json",
    runId: "run-command-preflight",
    issue: 452,
  }));
  const currentTreeSha = resolveCurrentReviewTreeSha(root);
  const targetStateDigest = buildRepairFingerprint({
    root,
    specPath: manager.load().spec,
    state: manager.load(),
  }).hash;
  const completed = await normalize({
    phase: "spec",
    treeSha: currentTreeSha,
    providerResult: providerResult({
      verdict: "PASS",
      blockingFindings: [],
      advisoryFindings: [],
    }),
  });
  new ReviewConvergenceStore({ flowManager: manager }).recordEvidence({
    evidence: completed.evidence,
    provider: "fixture-provider",
    targetStateDigest,
    expectedOriginal: manager.load(),
  });
  const stateBefore = Buffer.from(JSON.stringify(manager.load()));
  let providerStarts = 0;
  const command = new RunReviewCommand({
    runCommand() {
      providerStarts += 1;
      throw new Error("provider must not start for a completed target");
    },
  });

  const result = await command.execute({
    root,
    phase: "spec",
    config: { agent: {} },
    flowState: manager.load(),
    flowManager: manager,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "REVIEW_ALREADY_COMPLETED");
  assert.equal(providerStarts, 0);
  assert.deepEqual(Buffer.from(JSON.stringify(manager.load())), stateBefore);
});

test("R4: flow run review persists provider startup exceptions as TOOLING_ERROR", async (t) => {
  const {
    RunReviewCommand,
  } = await importRoot("src/flow/lib/run-review.js");
  const fixture = repositorySpecFixture(t, "review-startup-");
  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-startup-state-"));
  t.after(() => fs.rmSync(stateRoot, { recursive: true, force: true }));
  const manager = makeFlowManager(stateRoot);
  manager.create(makeFlowState({
    spec: fixture.spec,
    runId: "run-startup-tooling",
    issue: 452,
  }));
  const result = await new RunReviewCommand({
    runCommand() {
      throw new Error("provider launch failed");
    },
  }).execute({
    root,
    phase: "spec",
    config: { agent: {} },
    flowState: manager.load(),
    flowManager: manager,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "REVIEW_TOOLING_ERROR");
  assert.equal(result.data.toolingOutcome.stage, "startup");
  const persisted = manager.load().reviewConvergence.records[0];
  assert.equal(persisted.toolingOutcome.stage, "startup");
  assert.equal(persisted.semanticAttempts, 0);
});

test("R2: successful provider output without a canonical artifact is rejected without state mutation", async (t) => {
  const {
    RunReviewCommand,
  } = await importRoot("src/flow/lib/run-review.js");
  const fixture = repositorySpecFixture(t, "review-missing-artifact-");
  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-missing-artifact-state-"));
  t.after(() => fs.rmSync(stateRoot, { recursive: true, force: true }));
  const manager = makeFlowManager(stateRoot);
  manager.create(makeFlowState({
    spec: fixture.spec,
    runId: "run-missing-artifact",
    issue: 452,
  }));
  const stateBefore = Buffer.from(JSON.stringify(manager.load()));
  const evidenceDir = path.join(fixture.specDir, "review-evidence");
  const evidenceBefore = directorySnapshot(evidenceDir);
  const result = await new RunReviewCommand({
    runCommand() {
      return {
        ok: true,
        status: 0,
        stdout: "Spec review PASS. Review found no required fixes.",
        stderr: "[spec-review] verdict=PASS proposalCount=0",
        signal: null,
        killed: false,
      };
    },
  }).execute({
    root,
    phase: "spec",
    config: { agent: {} },
    flowState: manager.load(),
    flowManager: manager,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "REVIEW_EVIDENCE_ARTIFACT_REQUIRED");
  assert.deepEqual(Buffer.from(JSON.stringify(manager.load())), stateBefore);
  assert.deepEqual(directorySnapshot(evidenceDir), evidenceBefore);
});

test("R4: flow run review persists canonical promotion exceptions as TOOLING_ERROR", async (t) => {
  const {
    RunReviewCommand,
  } = await importRoot("src/flow/lib/run-review.js");
  const fixture = repositorySpecFixture(t, "review-canonical-write-");
  fs.writeFileSync(path.join(fixture.specDir, "spec-review.json"), `${JSON.stringify({
    verdict: "PASS",
    blockingFindings: [],
    nonBlockingImprovements: [],
    generatedAt: "2026-07-22T00:00:00.000Z",
  })}\n`);
  const evidencePath = path.join(fixture.specDir, "review-evidence");
  fs.writeFileSync(evidencePath, "canonical path conflict\n");
  const evidenceBefore = fs.readFileSync(evidencePath, "utf8");
  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-canonical-state-"));
  t.after(() => fs.rmSync(stateRoot, { recursive: true, force: true }));
  const manager = makeFlowManager(stateRoot);
  manager.create(makeFlowState({
    spec: fixture.spec,
    runId: "run-canonical-tooling",
    issue: 452,
  }));
  const artifactRel = path.relative(root, path.join(fixture.specDir, "spec-review.json"))
    .split(path.sep).join("/");
  const result = await new RunReviewCommand({
    runCommand() {
      return {
        ok: true,
        status: 0,
        stdout: "Spec review PASS. Review found no required fixes.",
        stderr: `  [spec-review] Results saved to ${artifactRel}\n  [spec-review] verdict=PASS proposalCount=0`,
        signal: null,
        killed: false,
      };
    },
  }).execute({
    root,
    phase: "spec",
    config: { agent: {} },
    flowState: manager.load(),
    flowManager: manager,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "REVIEW_TOOLING_ERROR");
  assert.equal(result.data.toolingOutcome.stage, "canonical_write");
  assert.equal(fs.readFileSync(evidencePath, "utf8"), evidenceBefore);
  const persisted = manager.load().reviewConvergence.records[0];
  assert.equal(persisted.toolingOutcome.stage, "canonical_write");
  assert.equal(persisted.semanticAttempts, 0);
});

test("R4: review post-hook failure preserves finalized evidence and persists TOOLING_ERROR", async (t) => {
  const {
    persistReviewPostHookToolingFailure,
  } = await importRoot("src/flow/lib/run-review.js");
  const {
    ReviewConvergenceStore,
  } = await importRoot("src/flow/lib/review-convergence.js");
  const {
    resolveCurrentReviewTreeSha,
  } = await importRoot("src/flow/lib/review-evidence-store.js");
  const {
    buildRepairFingerprint,
  } = await importRoot("src/flow/lib/impl-repair-artifacts.js");
  const fixture = repositorySpecFixture(t, "review-post-hook-");
  const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-post-hook-state-"));
  t.after(() => fs.rmSync(stateRoot, { recursive: true, force: true }));
  const manager = makeFlowManager(stateRoot);
  manager.create(makeFlowState({
    spec: fixture.spec,
    runId: "run-post-hook-tooling",
    issue: 452,
  }));
  const currentTreeSha = resolveCurrentReviewTreeSha(root);
  const currentTargetStateDigest = buildRepairFingerprint({
    root,
    specPath: fixture.spec,
    state: manager.load(),
  }).hash;
  const completed = await normalize({
    phase: "spec",
    treeSha: currentTreeSha,
    providerResult: providerResult({
      verdict: "PASS",
      blockingFindings: [],
      advisoryFindings: [],
    }),
  });
  new ReviewConvergenceStore({ flowManager: manager }).recordEvidence({
    evidence: completed.evidence,
    provider: "fixture-provider",
    targetStateDigest: currentTargetStateDigest,
    expectedOriginal: manager.load(),
  });
  const result = { artifacts: { phase: "spec", verdict: "PASS" } };

  const recorded = persistReviewPostHookToolingFailure({
    root,
    phase: "spec",
    flowState: manager.load(),
    flowManager: manager,
  }, result, new Error("review lifecycle projection failed"));

  assert.equal(recorded.outcome.stage, "post_hook");
  assert.equal(recorded.state.finalizedEvidenceAvailable, true);
  assert.equal(recorded.state.semanticAttempts, 0);
  assert.equal(result.reviewAction.kind, "register_alternative_evidence");
  assert.equal(manager.load().reviewConvergence.records[0].toolingOutcome.stage, "post_hook");
});

test("R2 R9: target state drift is rejected before canonical projection or convergence effects", async (t) => {
  const ReviewExecutionPipeline = await pipelineModel();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-stale-target-state-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const manager = makeFlowManager(tmp);
  manager.create(moveFlowToStep(makeFlowState({
    spec: "specs/001-review/spec.json",
    runId: "run-stale-target-state",
    issue: 452,
  }), "impl-review"));
  const boundaries = successfulBoundaries(null);
  let currentTargetStateDigest = targetStateDigest;
  boundaries.resolveCurrentTargetStateDigest = () => currentTargetStateDigest;
  const communicate = boundaries.communicate;
  boundaries.communicate = async (...args) => {
    const payload = await communicate(...args);
    currentTargetStateDigest = "8".repeat(64);
    return payload;
  };
  const evidenceDir = path.join(tmp, "specs", "001-review", "review-evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, "existing.json"), "stable\n");
  const evidenceBefore = directorySnapshot(evidenceDir);
  const effects = [];
  boundaries.writeCanonicalEvidence = async () => { effects.push("canonical_write"); };
  boundaries.writeProjection = async () => { effects.push("projection"); };
  boundaries.recordResult = async () => { effects.push("result_recording"); };
  const stateBefore = Buffer.from(JSON.stringify(manager.load()));

  const result = await new ReviewExecutionPipeline({ flowManager: manager, boundaries }).execute({
    phase: "impl",
    taskId: null,
    treeSha,
    provider: "fixture-provider",
  });

  assert.equal(result.executionStarted, true);
  assert.equal(result.rejection.code, "STALE_REVIEW_TARGET");
  assert.deepEqual(effects, []);
  assert.deepEqual(directorySnapshot(evidenceDir), evidenceBefore);
  assert.deepEqual(Buffer.from(JSON.stringify(manager.load())), stateBefore);
  assert.deepEqual(manager.load().reviewConvergence?.records || [], []);
});

test("R2 R7: provider telemetry mutations precede the fresh evidence-promotion CAS revision", async (t) => {
  const ReviewExecutionPipeline = await pipelineModel();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-provider-telemetry-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const manager = makeFlowManager(tmp);
  manager.create(moveFlowToStep(makeFlowState({
    spec: "specs/001-review/spec.json",
    runId: "run-provider-telemetry",
    issue: 452,
  }), "impl-review"));
  const boundaries = successfulBoundaries(null);
  const communicate = boundaries.communicate;
  boundaries.communicate = async (...args) => {
    manager.mutate((flowState) => {
      flowState.metrics ||= [];
      flowState.metrics.push({
        phase: "impl-review",
        counter: "providerTelemetry",
        delta: 0,
        taskId: null,
        ts: "2026-07-22T00:00:00.000Z",
      });
    });
    return communicate(...args);
  };

  const result = await new ReviewExecutionPipeline({ flowManager: manager, boundaries }).execute({
    phase: "impl",
    taskId: null,
    treeSha,
    provider: "fixture-provider",
  });

  assert.equal(result.reviewCompleted, true);
  assert.equal(result.evidence.disposition.value, "ADVISORY");
  assert.equal(manager.load().metrics.at(-1).counter, "providerTelemetry");
});

test("R7: phase-specific provider findings survive normalization into the canonical path", async () => {
  const result = await normalize({ providerResult: providerResult() });
  assert.equal(result.evidence.disposition.advisoryFindings[0].summary, "Non-blocking improvement.");
  assert.equal(result.evidence.identity.phase, "impl");
  assert.equal(result.evidence.identity.treeSha, treeSha);
  assert.match(result.evidence.identity.evidenceDigest, /^[a-f0-9]{64}$/);
});

test("R3 R7: acceptance assigns deferred dispositions after source preflight", async () => {
  const { artifactFromAcceptanceJudgments } = await importRoot(
    "src/flow/lib/acceptance-review-artifacts.js",
  );
  const context = {
    fingerprint: { hash: "a".repeat(64) },
    requirementIds: ["R3"],
    evidence: {
      diff: "diff --git a/src/review.js b/src/review.js\n",
      repairEvidence: { kind: "no-repair", ref: "acceptance:no-repair" },
    },
    mechanicalBlockers: [],
    deferredFindings: [{
      findingId: "RF-fixture-A-1",
      sourceStep: "impl-review",
      sourceArtifact: "review-evidence/fixture.json",
      sourceFindingId: "A-1",
      finalDisposition: "still_open",
      evidenceRefs: [],
    }],
  };
  const artifact = artifactFromAcceptanceJudgments({
    context,
    requirementJudgments: [{
      requirementId: "R3",
      status: "met",
      requestRefs: ["flow.request"],
      requirementRefs: ["spec.json#R3"],
      diffRefs: ["diff:src/review.js"],
      repairRefs: ["acceptance:no-repair"],
      testRefs: ["test-execute-result.json#R3"],
      missingEvidence: [],
    }],
    deferredFindingDispositions: [{
      findingId: "RF-fixture-A-1",
      finalDisposition: "not_needed",
      evidenceRefs: ["review-evidence/fixture.json#A-1"],
    }],
  });

  assert.equal(artifact.verdict, "pass");
  assert.equal(artifact.deferredFindings[0].finalDisposition, "not_needed");
  assert.deepEqual(artifact.hardBlockers, []);
});

test("R3 R7 R9: acceptance repairs omitted deferred coverage with one focused prompt", async () => {
  const {
    buildDeferredDispositionRepairPrompt,
    DeferredDispositionCoverage,
    MAX_ACCEPTANCE_DEFERRED_REPAIR_CALLS,
  } = await importRoot("src/flow/lib/run-acceptance-review.js");
  const finding = {
    findingId: "RF-fixture-A-1",
    sourceStep: "impl-review",
    sourceArtifact: "review-evidence/fixture.json",
    sourceFindingId: "A-1",
    finalDisposition: "still_open",
    evidenceRefs: [],
  };
  const context = {
    deferredFindings: [finding],
    evidence: {
      originalRequest: "Preserve bounded review convergence.",
      requirements: [{ id: "R3", desc: "Hand findings to acceptance." }],
      diff: "diff --git a/src/review.js b/src/review.js\n",
      repairEvidence: { kind: "no-repair", ref: "acceptance:no-repair" },
      testEvidence: { "test-result-review.json": { verdict: "pass" } },
      deferredFindingEvidence: [{
        findingId: finding.findingId,
        sourceRef: "review-evidence/fixture.json#A-1",
        sourceFinding: { findingId: "A-1", summary: "Advisory fixture." },
      }],
    },
  };
  const coverage = new DeferredDispositionCoverage(context, []);
  const prompt = buildDeferredDispositionRepairPrompt(context, coverage.missingFindings);

  assert.equal(MAX_ACCEPTANCE_DEFERRED_REPAIR_CALLS, 1);
  assert.equal(prompt.jsonSchema.properties.deferredFindingDispositions.minItems, 1);
  assert.equal(prompt.jsonSchema.properties.deferredFindingDispositions.maxItems, 1);
  assert.match(prompt.userPrompt, /review-evidence\/fixture\.json#A-1/);
});

test("R8: permission failure is external tooling state and never requests flow approval", async () => {
  const result = await normalize({
    toolingFailure: {
      stage: "startup",
      reason: "sandbox permission denied",
      attempt: 1,
      maxAttempts: 1,
      permissionRelated: true,
    },
    autoApprove: true,
  });
  assert.equal(result.toolingOutcome.kind, "TOOLING_ERROR");
  assert.equal(result.requiresApproval, false);
  assert.equal(result.privilegeEscalationAllowed, false);
});

test("R9: Issue 451 regression keeps finalized ADVISORY when projection recording fails", async () => {
  const result = await normalize({
    providerResult: providerResult(),
    toolingFailure: {
      stage: "projection",
      reason: "recording path unavailable",
      attempt: 1,
      maxAttempts: 1,
    },
  });
  assert.equal(result.evidence.disposition.value, "ADVISORY");
  assert.equal(result.evidence.disposition.blockingFindings.length, 0);
  assert.equal(result.toolingOutcome.kind, "TOOLING_ERROR");
  assert.equal(result.reviewCompleted, true);
  assert.equal(result.rerunAllowed, false);
  assert.equal(result.nextOperation.kind, "register_alternative_evidence");
});

test("R9: finalized ADVISORY remains available when canonical evidence writing fails", async () => {
  const result = await normalize({
    providerResult: providerResult(),
    toolingFailure: {
      stage: "canonical_write",
      reason: "canonical evidence path unavailable",
      attempt: 1,
      maxAttempts: 1,
    },
  });
  assert.equal(result.evidence.disposition.value, "ADVISORY");
  assert.equal(result.evidence.disposition.blockingFindings.length, 0);
  assert.deepEqual(result.evidence.findings.map((entry) => entry.findingId), ["A-1"]);
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.handoffFindings, []);
  assert.equal(result.finalizedEvidenceAvailable, true);
  assert.equal(result.canonicalEvidencePersisted, false);
  assert.equal(result.toolingOutcome.kind, "TOOLING_ERROR");
  assert.equal(result.toolingOutcome.stage, "canonical_write");
  assert.equal(result.reviewCompleted, false);
  assert.equal(result.rerunAllowed, false);
  assert.equal(result.nextOperation.kind, "register_alternative_evidence");
});
