import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  parseProposalReviewOutput,
  parseImplReviewOutput,
  parseSpecReviewOutput,
  parseTestReviewOutput,
  checkImplReviewTestArtifacts,
  RunReviewCommand,
  runCmdWithRetry,
  updateReviewRetryCounter,
} from "../../../src/flow/lib/run-review.js";
import { buildRepairFingerprint } from "../../../src/flow/lib/impl-repair-artifacts.js";
import { writeRepairFingerprintManifest } from "../../../src/flow/lib/repair-state-identity.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { ReviewFailure } from "../../../src/flow/lib/review-failure.js";
import {
  CompletionValidator,
  contractFromImplReviewArtifact,
} from "../../../src/flow/lib/flow-judgment-contract.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";

describe("draft review advisory routing", () => {
  it("parses ADVISORY as a non-blocking draft review result routed to coverage triage", () => {
    const coverageReviewName = "draft-review-coverage";
    const coverageArtifactPath = `specs/demo/${coverageReviewName}.json`;
    const result = parseProposalReviewOutput(
      { ok: true },
      "Draft review ADVISORY. 2 finding(s) recorded; proceeding.",
      `  [${coverageReviewName}] Results saved to ${coverageArtifactPath}\n  [${coverageReviewName}] verdict=ADVISORY findings=2 retryPhase=draft-coverage`,
    );

    assert.equal(result.result, "ok");
    assert.equal(result.next, "draft-coverage-triage");
    assert.deepEqual(result.changed, [coverageArtifactPath]);
    assert.deepEqual(result.artifacts, {
      phase: "draft",
      verdict: "ADVISORY",
      issueCount: 2,
      retryPhase: "draft-coverage",
    });
  });

  it("resets the draft review retry counter for ADVISORY", () => {
    const metrics = [];
    updateReviewRetryCounter(
      {
        phase: "draft",
        flowState: {},
        flowManager: {
          appendMetric(payload, opts) {
            metrics.push({ payload, opts });
          },
        },
      },
      {
        artifacts: {
          verdict: "ADVISORY",
          retryPhase: "draft-coverage",
        },
      },
    );

    assert.deepEqual(metrics, [
      {
        payload: {
          phase: "draft-coverage",
          counter: "reviewRetry",
          delta: 0,
          reset: true,
        },
        opts: { taskId: null },
      },
    ]);
  });

  it("promotes a draft-questions advisory artifact using its canonical phase", async () => {
    const root = createTmpDir("run-draft-review-canonical-phase-");
    const specPath = "specs/demo/spec.json";
    const specDir = path.join(root, "specs", "demo");
    try {
      fs.mkdirSync(specDir, { recursive: true });
      fs.writeFileSync(path.join(root, specPath), "{}\n");
      execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
      execFileSync("git", ["config", "user.email", "tests@example.invalid"], { cwd: root });
      execFileSync("git", ["config", "user.name", "Senti tests"], { cwd: root });
      execFileSync("git", ["add", "."], { cwd: root });
      execFileSync("git", ["commit", "-q", "-m", "baseline"], { cwd: root });
      const flowState = moveFlowToStep(makeFlowState({ spec: specPath }), "draft-questions-review");
      const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false });
      flowManager.create(flowState);
      const command = new RunReviewCommand({
        runCommand() {
          fs.writeFileSync(path.join(specDir, "draft-review-questions.json"), `${JSON.stringify({
            version: 1,
            phase: "draft-questions",
            sourceDraft: "draft.json",
            generatedAt: "2026-01-01T00:00:00.000Z",
            verdict: "ADVISORY",
            summary: "One advisory finding.",
            blockingFindings: [],
            advisoryFindings: [{ title: "Clarify the acceptance condition" }],
            repairTargets: [],
          }, null, 2)}\n`);
          return {
            ok: true,
            status: 0,
            stdout: "Draft review ADVISORY. 1 finding(s) recorded; proceeding.",
            stderr: "[draft-questions-review] Results saved to specs/demo/draft-review-questions.json\n[draft-questions-review] verdict=ADVISORY findings=1 retryPhase=draft-questions",
            signal: null,
            killed: false,
          };
        },
      });

      const result = await command.execute({
        root,
        phase: "draft",
        config: { agent: {} },
        flowState: flowManager.load(),
        flowManager,
      });

      assert.equal(result.result, "ok", JSON.stringify(result));
      assert.equal(result.next, "draft-questions-triage");
      assert.equal(result.artifacts.retryPhase, "draft-questions");
      assert.equal(flowManager.load().reviewConvergence.records[0].phase, "draft-questions");
      assert.equal(fs.readdirSync(path.join(specDir, "review-evidence")).length, 1);
    } finally {
      removeTmpDir(root);
    }
  });
});

describe("spec review advisory verdict", () => {
  it("uses the canonical 900-second agent timeout for the review subprocess", async () => {
    const root = createTmpDir("run-review-timeout-");
    fs.mkdirSync(path.join(root, "specs", "demo"), { recursive: true });
    let processOptions = null;
    const command = new RunReviewCommand({
      finalizeResult: ({ parse }) => parse(),
      resolveTreeSha: () => "a".repeat(40),
      resolveTargetStateDigest: () => "b".repeat(64),
      runCommand(_command, _args, options) {
        processOptions = options;
        return {
          ok: true,
          status: 0,
          stdout: "Spec review PASS. Review found no required fixes.",
          stderr: "[spec-review] verdict=PASS proposalCount=0",
          signal: null,
          killed: false,
        };
      },
    });

    try {
      const result = await command.execute({
        root,
        phase: "spec",
        config: { agent: {} },
        flowState: { spec: "specs/demo/spec.json", metrics: [], steps: [] },
      });

      assert.equal(processOptions.timeout, 900_000);
      assert.equal(result.result, "ok");
    } finally {
      removeTmpDir(root);
    }
  });

  it("parses ADVISORY as a non-blocking spec review result", () => {
    const result = parseSpecReviewOutput(
      { ok: true },
      "Spec review ADVISORY. 2 non-blocking improvement(s) recorded. See spec-review.md.",
      "  [spec-review] Results saved to specs/demo/spec-review.md\n  [spec-review] blockingCount=0 improvementCount=2 proposalCount=2\n  [spec-review] verdict=ADVISORY proposalCount=2",
    );

    assert.equal(result.result, "ok");
    assert.equal(result.next, "spec-gate");
    assert.deepEqual(result.changed, ["specs/demo/spec-review.md"]);
    assert.deepEqual(result.artifacts, {
      phase: "spec",
      verdict: "ADVISORY",
      proposalCount: 2,
    });
  });

  it("routes REJECTED to spec-triage instead of a prompt-owned review loop", () => {
    const result = parseSpecReviewOutput(
      { ok: true },
      "Spec review REJECTED. 1 blocking finding(s) found. See spec-review.md.",
      "  [spec-review] Results saved to specs/demo/spec-review.md\n  [spec-review] blockingCount=1 improvementCount=0 proposalCount=1\n  [spec-review] verdict=REJECTED proposalCount=1",
    );

    assert.equal(result.result, "ok");
    assert.equal(result.next, "spec-triage");
    assert.deepEqual(result.artifacts, {
      phase: "spec",
      verdict: "REJECTED",
      proposalCount: 1,
    });
  });

  it("post-hook advances REJECTED to spec-triage by completing spec-review only", async () => {
    const updates = [];
    const metrics = [];
    const flowState = {
      currentTaskId: null,
      steps: [
        { id: "spec-review", status: "in_progress" },
        { id: "spec-triage", status: "pending" },
        { id: "spec-repair", status: "pending" },
      ],
      tasks: [],
    };
    await FLOW_COMMANDS.run.review.post({
      phase: "spec",
      flowState,
      flowManager: {
        appendMetric(payload, opts) { metrics.push({ payload, opts }); },
        updateStepStatus(transition) {
          updates.push({ stepId: transition.stepId, status: transition.requestedStatus });
          flowState.steps.find((step) => step.id === transition.stepId).status = transition.requestedStatus;
        },
      },
    }, {
      artifacts: { phase: "spec", verdict: "REJECTED", proposalCount: 1 },
    });

    assert.deepEqual(updates, [{ stepId: "spec-review", status: "done" }]);
    assert.deepEqual(metrics, [{
      payload: { phase: "spec", counter: "reviewRetry", delta: 1 },
      opts: { taskId: null },
    }]);
  });

  it("post-hook skips spec-repair for non-blocking spec review results", async () => {
    const updates = [];
    const flowState = {
      currentTaskId: null,
      steps: [
        { id: "spec-review", status: "in_progress" },
        { id: "spec-triage", status: "pending" },
        { id: "spec-repair", status: "pending" },
      ],
      tasks: [],
    };
    await FLOW_COMMANDS.run.review.post({
      phase: "spec",
      flowState,
      flowManager: {
        appendMetric() {},
        updateStepStatus(transition) {
          updates.push({ stepId: transition.stepId, status: transition.requestedStatus });
          flowState.steps.find((step) => step.id === transition.stepId).status = transition.requestedStatus;
        },
      },
    }, {
      artifacts: { phase: "spec", verdict: "ADVISORY", proposalCount: 1 },
    });

    assert.deepEqual(updates, [
      { stepId: "spec-review", status: "done" },
      { stepId: "spec-triage", status: "done" },
      { stepId: "spec-repair", status: "done" },
    ]);
  });
});

describe("test-review one-shot verdict routing", () => {
  it("parses ADVISORY as non-blocking and routes to implement", () => {
    const result = parseTestReviewOutput(
      { ok: true },
      "Test review ADVISORY. 2 non-blocking finding(s) recorded; implementation may proceed.",
      "  [test-review] Results saved to specs/demo/test-review.md\n  [test-review] verdict=ADVISORY blocking=0 advisory=2",
    );

    assert.equal(result.result, "ok");
    assert.equal(result.next, "implement");
    assert.deepEqual(result.changed, ["specs/demo/test-review.md"]);
    assert.deepEqual(result.artifacts, {
      phase: "test",
      verdict: "ADVISORY",
      blockingCount: 0,
      advisoryCount: 2,
    });
  });

  it("parses TOOLING_ERROR without routing to implementation", () => {
    const result = parseTestReviewOutput(
      { ok: true },
      "Test review TOOLING_ERROR. Static review tooling failed; see test-review.json.",
      "  [test-review] Results saved to specs/demo/test-review.md\n  [test-review] outcome=TOOLING_ERROR stage=parse attempt=1 maxAttempts=1 toolingKind=parser_error blocking=0 advisory=0",
    );

    assert.equal(result.result, "tooling-error");
    assert.equal(result.next, null);
    assert.deepEqual(result.artifacts, {
      phase: "test",
      toolingOutcome: {
        kind: "TOOLING_ERROR",
        stage: "parse",
        attempt: 1,
        maxAttempts: 1,
        remainingAttempts: 0,
        reason: "parser_error",
        permissionRelated: false,
      },
      blockingCount: 0,
      advisoryCount: 0,
    });
  });

  it("post-hook completes test-review for ADVISORY and skips task/tooling retry metrics", async () => {
    const updates = [];
    const metrics = [];
    const flowState = {
      currentTaskId: "T-1",
      steps: [{ id: "test-review", status: "in_progress" }],
      tasks: [{
        id: "T-1",
        steps: [
          { id: "task-impl", status: "pending" },
          { id: "task-review", status: "pending" },
          { id: "task-gate", status: "pending" },
        ],
      }],
    };
    await FLOW_COMMANDS.run.review.post({
      phase: "test",
      flowState,
      flowManager: {
        appendMetric(payload, opts) { metrics.push({ payload, opts }); },
        updateStepStatus(transition, opts) {
          updates.push({ stepId: transition.stepId, status: transition.requestedStatus, opts });
          flowState.steps.find((step) => step.id === transition.stepId).status = transition.requestedStatus;
        },
      },
    }, {
      artifacts: { phase: "test", verdict: "ADVISORY", blockingCount: 0, advisoryCount: 1 },
    });

    assert.deepEqual(updates, [{
      stepId: "test-review",
      status: "done",
      opts: { taskId: null },
    }]);
    assert.deepEqual(metrics, []);

    const tmp = createTmpDir();
    try {
      fs.mkdirSync(path.join(tmp, "specs/demo"), { recursive: true });
      const toolingMetrics = [];
      await FLOW_COMMANDS.run.review.post({
        phase: "test",
        root: tmp,
        flowState: { spec: "specs/demo/spec.json" },
        flowManager: {
          appendMetric(payload, opts) { toolingMetrics.push({ payload, opts }); },
          updateStepStatus() { throw new Error("TOOLING_ERROR must not complete test-review"); },
        },
      }, {
        changed: ["specs/demo/test-review.json"],
        artifacts: {
          phase: "test",
          toolingOutcome: {
            kind: "TOOLING_ERROR",
            stage: "parse",
            attempt: 1,
            maxAttempts: 1,
            remainingAttempts: 0,
            reason: "parser_error",
            permissionRelated: false,
          },
          blockingCount: 0,
          advisoryCount: 0,
        },
      });
      assert.deepEqual(toolingMetrics, []);
      const issueLog = JSON.parse(fs.readFileSync(path.join(tmp, "specs/demo/issue-log.json"), "utf8"));
      assert.equal(issueLog.entries.length, 1);
      assert.equal(issueLog.entries[0].step, "test-review");
      assert.equal(issueLog.entries[0].failureKind, "tooling_failure");
    } finally {
      removeTmpDir(tmp);
    }
  });
});

describe("impl review structured verdict routing", () => {
  it("accepts consistent PASS, ADVISORY, and FAIL completion contracts", () => {
    const cases = [
      { verdict: "PASS", blockingFindings: [], nonBlockingImprovements: [] },
      { verdict: "ADVISORY", blockingFindings: [], nonBlockingImprovements: [{ title: "Improve" }] },
      { verdict: "REJECTED", blockingFindings: [{ findingId: "F-1" }], nonBlockingImprovements: [] },
    ];
    for (const artifact of cases) {
      const contract = contractFromImplReviewArtifact(artifact);
      const validation = new CompletionValidator().validate({ contract, requestedStatus: "done" });
      assert.equal(validation.kind, "normal", artifact.verdict);
      assert.equal(contract.summary.completionKind, "normal", artifact.verdict);
    }
  });

  it("rejects missing buckets and verdicts inconsistent with recorded findings", () => {
    assert.throws(
      () => contractFromImplReviewArtifact({ verdict: "PASS", nonBlockingImprovements: [] }),
      /blockingFindings must be an array/,
    );
    assert.throws(
      () => contractFromImplReviewArtifact({ verdict: "PASS", blockingFindings: [] }),
      /nonBlockingImprovements must be an array/,
    );
    assert.throws(
      () => contractFromImplReviewArtifact({
        verdict: "PASS",
        blockingFindings: {},
        nonBlockingImprovements: [],
      }),
      /blockingFindings must be an array/,
    );
    assert.throws(
      () => contractFromImplReviewArtifact({
        verdict: "PASS",
        blockingFindings: [],
        nonBlockingImprovements: {},
      }),
      /nonBlockingImprovements must be an array/,
    );
    assert.throws(
      () => contractFromImplReviewArtifact({
        verdict: "PASS",
        blockingFindings: [{ findingId: "F-1" }],
        nonBlockingImprovements: [],
      }),
      /verdict must be REJECTED/,
    );
    assert.throws(
      () => contractFromImplReviewArtifact({
        verdict: "REJECTED",
        blockingFindings: [],
        nonBlockingImprovements: [{ title: "Improve" }],
      }),
      /verdict must be ADVISORY/,
    );
    assert.throws(
      () => contractFromImplReviewArtifact({
        verdict: "ADVISORY",
        blockingFindings: [],
        nonBlockingImprovements: [],
      }),
      /verdict must be PASS/,
    );
  });

  it("parses ADVISORY as non-blocking and routes to impl-gate", () => {
    const result = parseImplReviewOutput(
      { ok: true },
      "Impl review ADVISORY. 1 non-blocking improvement(s) recorded. See review.md.",
      "  [review] Results saved to specs/demo/review.md\n  [review] JSON saved to specs/demo/impl-review.json\n  [review] verdict=ADVISORY blocking=0 nonBlocking=1",
    );

    assert.equal(result.result, "ok");
    assert.equal(result.next, "impl-gate");
    assert.deepEqual(result.changed, ["specs/demo/review.md", "specs/demo/impl-review.json"]);
    assert.deepEqual(result.artifacts, {
      phase: "impl",
      verdict: "ADVISORY",
      blockingCount: 0,
      nonBlockingCount: 1,
    });
  });

  it("resets reviewRetry for PASS and ADVISORY but increments for REJECTED", () => {
    assert.deepEqual(metricsForImplVerdict("PASS"), [{
      payload: { phase: "impl", counter: "reviewRetry", delta: 0, reset: true },
      opts: { taskId: null },
    }]);
    assert.deepEqual(metricsForImplVerdict("ADVISORY"), [{
      payload: { phase: "impl", counter: "reviewRetry", delta: 0, reset: true },
      opts: { taskId: null },
    }]);
    assert.deepEqual(metricsForImplVerdict("REJECTED"), [{
      payload: { phase: "impl", counter: "reviewRetry", delta: 1 },
      opts: { taskId: null },
    }]);
  });

  it("post-hook closes no-repair leaves and routes REJECTED to impl-triage", async () => {
    async function updatesFor(verdict, blockingCount, nonBlockingCount, priorStatuses = {}) {
      const updates = [];
      const flowState = {
        currentTaskId: null,
        steps: [
          { id: "impl-review", status: "in_progress" },
          { id: "impl-triage", status: "pending" },
          { id: "impl-repair", status: priorStatuses.implRepair || "pending" },
          { id: "impl-gate", status: priorStatuses.implGate || "pending" },
        ],
        tasks: [],
      };
      await FLOW_COMMANDS.run.review.post({
        phase: null,
        flowState,
        flowManager: {
          appendMetric() {},
          mutate(mutator) {
            mutator(flowState);
          },
          updateStepStatus(transition) {
            updates.push({ stepId: transition.stepId, status: transition.requestedStatus });
            flowState.steps.find((step) => step.id === transition.stepId).status = transition.requestedStatus;
          },
        },
      }, {
        artifacts: { phase: "impl", verdict, blockingCount, nonBlockingCount },
      });
      return { updates, flowState };
    }

    const noRepairUpdates = [
      { stepId: "impl-review", status: "done" },
      { stepId: "impl-triage", status: "done" },
      { stepId: "impl-repair", status: "done" },
      { stepId: "impl-gate", status: "in_progress" },
    ];
    assert.deepEqual((await updatesFor("PASS", 0, 0)).updates, noRepairUpdates);
    assert.deepEqual((await updatesFor("ADVISORY", 0, 1)).updates, noRepairUpdates);
    const rejected = await updatesFor("REJECTED", 1, 0, {
      implRepair: "done",
      implGate: "done",
    });
    assert.deepEqual(rejected.updates, [
      { stepId: "impl-review", status: "done" },
      { stepId: "impl-triage", status: "in_progress" },
    ]);
    assert.equal(findStepById(rejected.flowState.steps, "impl-repair").status, "pending");
    assert.equal(findStepById(rejected.flowState.steps, "impl-gate").status, "pending");
  });

  it("rewinds stale test evidence before starting implementation review", () => {
    const root = createTmpDir("run-review-stale-evidence-");
    const specDir = path.join(root, "specs", "demo");
    const specPath = "specs/demo/spec.json";
    const initialSource = path.join(root, "src", "demo.js");
    try {
      fs.mkdirSync(specDir, { recursive: true });
      fs.mkdirSync(path.dirname(initialSource), { recursive: true });
      fs.writeFileSync(path.join(root, specPath), "{}\n");
      fs.writeFileSync(initialSource, "export const demo = false;\n");
      const previousFingerprint = buildRepairFingerprint({ root, specPath });
      writeRepairFingerprintManifest(specDir, previousFingerprint);
      const flowState = moveFlowToStep(makeFlowState({
        spec: specPath,
        repairBaseline: previousFingerprint.baseline.toJSON(),
      }), "impl-review");
      for (const file of ["test-execute-result.json", "test-result-review.json"]) {
        fs.writeFileSync(path.join(specDir, file), `${JSON.stringify({
          repairFingerprint: previousFingerprint.hash,
        })}\n`);
      }
      fs.writeFileSync(initialSource, "export const demo = true;\n");
      const currentFingerprint = buildRepairFingerprint({
        root,
        specPath,
        state: flowState,
      });
      const flowManager = new FlowManager({
        root,
        mainRoot: root,
        inWorktree: false,
      });
      flowManager.create(flowState);
      const activeState = flowManager.loadReadOnly();
      const result = checkImplReviewTestArtifacts({
        root,
        state: activeState,
        specDir,
        fingerprint: currentFingerprint,
        flowManager,
      });
      const recoveredState = flowManager.loadReadOnly();

      assert.equal(result.result, "recovered");
      assert.equal(result.next, "test-execute");
      assert.equal(result.artifacts.evidenceRefresh.recovered, true);
      assert.deepEqual(result.artifacts.staleArtifacts, [
        "test-execute-result.json",
        "test-result-review.json",
      ]);
      assert.equal(findStepById(recoveredState.steps, "test-execute").status, "in_progress");
      assert.equal(findStepById(recoveredState.steps, "test-result-review").status, "pending");
      assert.equal(findStepById(recoveredState.steps, "impl-review").status, "pending");
      assert.equal(fs.existsSync(path.join(specDir, "test-execute-result.json")), false);
      assert.equal(fs.existsSync(path.join(specDir, "test-result-review.json")), false);
    } finally {
      removeTmpDir(root);
    }
  });

  it("skips the normal review post-hook after stale evidence recovery", async () => {
    let loaded = false;
    await FLOW_COMMANDS.run.review.post({
      flowManager: {
        load() {
          loaded = true;
          throw new Error("normal review lifecycle must not run");
        },
      },
    }, {
      result: "recovered",
      artifacts: {
        evidenceRefresh: { recovered: true },
      },
    });
    assert.equal(loaded, false);
  });
});

function metricsForImplVerdict(verdict) {
  const metrics = [];
  updateReviewRetryCounter(
    {
      phase: null,
      flowState: {},
      flowManager: {
        appendMetric(payload, opts) { metrics.push({ payload, opts }); },
      },
    },
    {
      artifacts: {
        phase: "impl",
        verdict,
        blockingCount: verdict === "REJECTED" ? 1 : 0,
        nonBlockingCount: verdict === "ADVISORY" ? 1 : 0,
      },
    },
  );
  return metrics;
}

describe("review subprocess retry", () => {
  it("retries impl schema failures within the tooling limit and preserves diagnostics", async () => {
    let calls = 0;
    const result = await runCmdWithRetry(() => {
      calls += 1;
      const failure = ReviewFailure.schemaFailure({
        phase: "impl",
        targetReview: "impl-review",
        validationError: "requirementId is unknown",
        currentAttempt: 1,
        maximumAttempts: 1,
      });
      return {
        ok: false,
        status: 1,
        stdout: "",
        stderr: failure.toMarkerLine(),
        signal: null,
        killed: false,
      };
    }, { phase: "impl", retryCount: 2, retryDelayMs: 0 });

    const failure = ReviewFailure.fromSubprocessResult({ phase: "impl", result });
    assert.equal(calls, 3);
    assert.equal(failure.classification, "schema_failure");
    assert.equal(failure.currentAttempt, 3);
    assert.equal(failure.maximumAttempts, 3);
  });

  it("does not retry deterministic test-review prompt size failures", async () => {
    let calls = 0;
    const result = await runCmdWithRetry(() => {
      calls++;
      return {
        ok: false,
        status: 1,
        stdout: "",
        stderr: "TEST_REVIEW_PROMPT_TOO_LARGE: gap analysis prompt is too large",
        signal: null,
        killed: false,
      };
    }, { retryCount: 2, retryDelayMs: 0 });

    assert.equal(calls, 1);
    assert.equal(result.status, 1);
  });
});
