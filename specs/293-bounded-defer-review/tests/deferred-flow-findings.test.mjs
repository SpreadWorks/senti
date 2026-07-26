// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { makeFlowManager, setupFlow } from "../../../tests/helpers/flow-setup.js";
import {
  createAcceptanceReviewFixture,
  runAcceptanceReviewFixture,
} from "../../../tests/helpers/acceptance-review-fixture.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { runGit } from "../../../src/lib/git-helpers.js";

let tmp;
afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function makeSpecDir() {
  tmp = createTmpDir("senti-flow-findings-");
  const specDir = path.join(tmp, "specs", "001-test");
  fs.mkdirSync(specDir, { recursive: true });
  return specDir;
}

function writeJsonFile(file, value) {
  if (path.basename(file) === "flow-findings.json" && Array.isArray(value?.entries)) {
    value = {
      ...value,
      version: 2,
      entries: value.entries.map((entry, index) => ({
        ...entry,
        fingerprint: entry.fingerprint || String(index + 1).padStart(64, "0"),
        disposition: entry.disposition || "deferred",
        rationale: entry.rationale || "The bounded retry policy deferred this semantic finding.",
      })),
    };
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

async function importFlowFindingsModule() {
  const moduleUrl = new URL("../../../src/flow/lib/flow-findings.js", import.meta.url);
  assert.ok(fs.existsSync(fileURLToPath(moduleUrl)), "src/flow/lib/flow-findings.js should exist");
  return import(moduleUrl.href);
}

function baseFlowState(overrides = {}) {
  const { steps: suppliedSteps = buildInitialSteps(), ...rest } = overrides;
  const steps = suppliedSteps;
  findStepById(steps, "branch").status = "done";
  return {
    runId: "run-293-flow-findings",
    spec: "specs/001-test/spec.json",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps,
    requirements: [{ id: "R1", desc: "test", priority: "must", status: "pending" }],
    tasks: [],
    currentTaskId: null,
    metrics: [],
    ...rest,
    steps,
  };
}

function writeBaseSpec(specDir) {
  writeJsonFile(path.join(specDir, "spec.json"), {
    goal: "test",
    scope: { in: ["test"], out: [] },
    requirements: [{ id: "R1", desc: "test", priority: "must" }],
    tasks: [],
  });
}

function writeReviewArtifact(specDir, file = "spec-review.json") {
  writeJsonFile(path.join(specDir, file), {
    verdict: "FAIL",
    retryPhase: "spec",
    blockingFindings: [
      {
        findingId: "F-review-1",
        disposition: "deferred",
        rationale: "The bounded retry policy may defer this semantic review finding.",
        kind: "content_alignment",
        summary: "The detector reported a requirement alignment concern.",
      },
    ],
  });
}

function writeGateSourceArtifact(specDir, file = "spec-gate-source.json") {
  writeJsonFile(path.join(specDir, file), {
    phase: "spec",
    result: "fail",
    evaluations: [
      {
        findingId: "F-gate-1",
        guardrail_id: "spec-content-alignment",
        result: "fail",
        failureMode: "content_alignment",
        reason: "The detector reported a requirement alignment concern.",
      },
    ],
  });
}

function assertGit(args, cwd) {
  const result = runGit(args, { cwd });
  assert.equal(result.ok, true, `git ${args.join(" ")} failed: ${result.stderr}`);
}

function initializeGitRepo(root) {
  assertGit(["init"], root);
  assertGit(["config", "user.email", "senti-test@example.invalid"], root);
  assertGit(["config", "user.name", "senti test"], root);
  assertGit(["add", "."], root);
  assertGit(["commit", "-m", "initial"], root);
}

function setupFlowManager(state) {
  setupFlow(tmp, state);
  return makeFlowManager(tmp);
}

describe("deferred flow findings", () => {
  it("R4: persists bounded reference-only flow-findings entries", async () => {
    const specDir = makeSpecDir();
    const {
      FlowFinding,
      FlowFindingsArtifact,
      writeFlowFindingsArtifact,
      readFlowFindingsArtifact,
      FLOW_FINDINGS_FILE,
    } = await importFlowFindingsModule();

    const artifact = new FlowFindingsArtifact({
      entries: [
        new FlowFinding({
          findingId: "DF-1",
          sourceStep: "spec-review",
          sourceArtifact: "spec-review.json",
          sourceFindingId: "F-review-1",
          fingerprint: "1".repeat(64),
          disposition: "deferred",
          rationale: "The bounded retry policy deferred this semantic finding.",
          retryExhausted: true,
          attempts: 2,
          round: 1,
          completionKind: "deferred",
          finalDisposition: null,
        }),
      ],
    });

    const file = writeFlowFindingsArtifact(specDir, artifact);
    const persisted = readFlowFindingsArtifact(specDir);
    const entry = persisted.entries[0];
    assert.equal(path.basename(file), FLOW_FINDINGS_FILE);
    assert.equal(persisted.entries.length, 1);
    assert.equal(entry.findingId, "DF-1");
    assert.equal(entry.sourceStep, "spec-review");
    assert.equal(entry.sourceArtifact, "spec-review.json");
    assert.equal(entry.sourceFindingId, "F-review-1");
    assert.equal(entry.retryExhausted, true);
    assert.equal(entry.attempts, 2);
    assert.equal(entry.round, 1);
    assert.equal(entry.completionKind, "deferred");
    assert.equal(entry.finalDisposition, null);
    assert.equal(Object.hasOwn(entry, "summary"), false);
    assert.equal(Object.hasOwn(entry, "reason"), false);
    assert.equal(Object.hasOwn(entry, "details"), false);

    assert.throws(() => new FlowFinding({
      findingId: "DF-escape",
      sourceStep: "spec-review",
      sourceArtifact: "../outside.json",
      sourceFindingId: "F-review-escape",
      fingerprint: "a".repeat(64),
      disposition: "deferred",
      rationale: "The path must remain inside the spec directory.",
      retryExhausted: true,
      attempts: 2,
      round: 1,
      completionKind: "deferred",
      finalDisposition: null,
    }), /sourceArtifact/);
    assert.throws(() => new FlowFinding({
      findingId: "DF-absolute",
      sourceStep: "spec-review",
      sourceArtifact: "/tmp/outside.json",
      sourceFindingId: "F-review-absolute",
      fingerprint: "a".repeat(64),
      disposition: "deferred",
      rationale: "The path must remain inside the spec directory.",
      retryExhausted: true,
      attempts: 2,
      round: 1,
      completionKind: "deferred",
      finalDisposition: null,
    }), /sourceArtifact/);
  });

  it("R1: deferred completion evidence allows done traversal without rewriting failed detector artifacts", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    const { buildRepairFingerprint } = await import("../../../src/flow/lib/impl-repair-artifacts.js");
    const repairFingerprint = buildRepairFingerprint({
      root: tmp,
      specPath: "specs/001-test/spec.json",
      state: { spec: "specs/001-test/spec.json" },
    }).hash;
    writeJsonFile(path.join(specDir, "impl-gate-result.json"), {
      phase: "integration",
      result: "fail",
      verdict: "fail",
      nextAction: null,
      evaluations: [{ findingId: "F-gate-1", result: "fail", failureMode: "content_alignment" }],
      repairFingerprint,
    });
    writeJsonFile(path.join(specDir, "flow-findings.json"), {
      version: 1,
      entries: [
        {
          findingId: "DF-1",
          sourceStep: "impl-gate",
          sourceArtifact: "impl-gate-result.json",
          sourceFindingId: "F-gate-1",
          retryExhausted: true,
          attempts: 2,
          round: 1,
          completionKind: "deferred",
          finalDisposition: null,
        },
      ],
    });
    const { validateStepCompletionTransition } = await import("../../../src/flow/lib/flow-judgment-contract.js");
    const fail = validateStepCompletionTransition({
      root: tmp,
      state: { spec: "specs/001-test/spec.json" },
      stepId: "impl-gate",
      requestedStatus: "done",
    });
    assert.equal(fail, null);
    assert.equal(JSON.parse(fs.readFileSync(path.join(specDir, "impl-gate-result.json"), "utf8")).result, "fail");
    const flowState = baseFlowState();
    findStepById(flowState.steps, "impl-gate").status = "done";
    const statusValues = new Set(flattenSteps(flowState.steps).map((step) => step.status));
    assert.deepEqual([...statusValues].sort(), ["done", "pending"]);
    assert.equal(statusValues.has("deferred"), false);
  });

  it("R1: deferred completion evidence requires exact spec-relative artifact path", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    const { buildRepairFingerprint } = await import("../../../src/flow/lib/impl-repair-artifacts.js");
    const repairFingerprint = buildRepairFingerprint({
      root: tmp,
      specPath: "specs/001-test/spec.json",
      state: { spec: "specs/001-test/spec.json" },
    }).hash;
    writeJsonFile(path.join(specDir, "impl-gate-result.json"), {
      phase: "integration",
      result: "fail",
      verdict: "fail",
      evaluations: [{ findingId: "F-real", result: "fail", failureMode: "content_alignment" }],
      repairFingerprint,
    });
    writeJsonFile(path.join(specDir, "nested", "impl-gate-result.json"), {
      phase: "integration",
      result: "fail",
      verdict: "fail",
      evaluations: [{ findingId: "F-nested", result: "fail", failureMode: "content_alignment" }],
    });
    writeJsonFile(path.join(specDir, "flow-findings.json"), {
      version: 1,
      entries: [
        {
          findingId: "DF-1",
          sourceStep: "impl-gate",
          sourceArtifact: "nested/impl-gate-result.json",
          sourceFindingId: "F-nested",
          retryExhausted: true,
          attempts: 2,
          round: 1,
          completionKind: "deferred",
          finalDisposition: null,
        },
      ],
    });
    const { validateStepCompletionTransition } = await import("../../../src/flow/lib/flow-judgment-contract.js");
    const fail = validateStepCompletionTransition({
      root: tmp,
      state: { spec: "specs/001-test/spec.json" },
      stepId: "impl-gate",
      requestedStatus: "done",
    });
    assert.notEqual(fail, null);

    writeJsonFile(path.join(specDir, "impl-gate-result.json"), {
      phase: "integration",
      result: "fail",
      verdict: "fail",
      command: { marker: "unrelated-id" },
      evaluations: [{ findingId: "F-real", result: "fail", failureMode: "content_alignment" }],
      repairFingerprint,
    });
    writeJsonFile(path.join(specDir, "flow-findings.json"), {
      version: 1,
      entries: [
        {
          findingId: "DF-2",
          sourceStep: "impl-gate",
          sourceArtifact: "impl-gate-result.json",
          sourceFindingId: "unrelated-id",
          retryExhausted: true,
          attempts: 2,
          round: 1,
          completionKind: "deferred",
          finalDisposition: null,
        },
      ],
    });
    const unrelated = validateStepCompletionTransition({
      root: tmp,
      state: { spec: "specs/001-test/spec.json" },
      stepId: "impl-gate",
      requestedStatus: "done",
    });
    assert.notEqual(unrelated, null);
  });

  it("R2: review retry exhaustion with only content alignment findings writes flow findings and does not hard stop", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeReviewArtifact(specDir);
    const fm = setupFlowManager(baseFlowState({
      steps: buildInitialSteps().map((step) => {
        if (step.id !== "plan") return step;
        return {
          ...step,
          children: step.children.map((child) => (
            child.id === "spec-review" ? { ...child, status: "in_progress" } : child
          )),
        };
      }),
      metrics: [
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
      ],
    }));
    const { default: RunReviewCommand } = await import("../../../src/flow/lib/run-review.js");
    const result = await new RunReviewCommand().execute({
      root: tmp,
      flowManager: fm,
      flowState: fm.load(),
      phase: "spec",
    });
    assert.equal(result.result, "deferred");
    assert.equal(result.artifacts.deferred, true);
    const findings = JSON.parse(fs.readFileSync(path.join(specDir, "flow-findings.json"), "utf8"));
    assert.equal(findings.entries[0].sourceStep, "spec-review");
    assert.equal(findings.entries[0].sourceArtifact, "spec-review.json");
    assert.equal(findStepById(fm.load().steps, "spec-review").status, "done");
  });

  it("R2: review retry exhaustion with non-AI findings remains blocking", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeJsonFile(path.join(specDir, "spec-review.json"), {
      verdict: "FAIL",
      retryPhase: "spec",
      blockingFindings: [
        {
          findingId: "F-review-mechanical-1",
          kind: "schema_invalid",
          failureMode: "invalid_schema",
          summary: "The review artifact schema is invalid.",
        },
      ],
    });
    const fm = setupFlowManager(baseFlowState({
      steps: buildInitialSteps().map((step) => {
        if (step.id !== "plan") return step;
        return {
          ...step,
          children: step.children.map((child) => (
            child.id === "spec-review" ? { ...child, status: "in_progress" } : child
          )),
        };
      }),
      metrics: [
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
      ],
    }));
    const { checkReviewRetryBelowMax } = await import("../../../src/flow/lib/run-review.js");
    const result = checkReviewRetryBelowMax({ root: tmp, flowManager: fm, flowState: fm.load(), phase: "spec" }, "spec");
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "REVIEW_MAX_ATTEMPTS_EXCEEDED");
    assert.equal(fs.existsSync(path.join(specDir, "flow-findings.json")), false);
    assert.equal(findStepById(fm.load().steps, "spec-review").status, "in_progress");
  });

  it("R2: review retry exhaustion injects durable source finding ids before deferral", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeJsonFile(path.join(specDir, "spec-review.json"), {
      verdict: "FAIL",
      retryPhase: "spec",
      blockingFindings: [
        {
          kind: "content_alignment",
          summary: "The detector reported an alignment concern without a durable id.",
        },
      ],
    });
    const fm = setupFlowManager(baseFlowState({
      metrics: [
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
      ],
    }));
    const { checkReviewRetryBelowMax } = await import("../../../src/flow/lib/run-review.js");
    const result = checkReviewRetryBelowMax({ root: tmp, flowManager: fm, flowState: fm.load(), phase: "spec" }, "spec");
    assert.equal(result.result, "deferred");
    const source = JSON.parse(fs.readFileSync(path.join(specDir, "spec-review.json"), "utf8"));
    assert.equal(source.blockingFindings[0].findingId, "review-finding-1");
    const findings = JSON.parse(fs.readFileSync(path.join(specDir, "flow-findings.json"), "utf8"));
    assert.equal(findings.entries[0].sourceFindingId, "review-finding-1");
  });

  it("R2: production semantic review failure modes defer after retry exhaustion", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeJsonFile(path.join(specDir, "spec-review.json"), {
      verdict: "FAIL",
      retryPhase: "spec",
      blockingFindings: [
        {
          failureMode: "missing_acceptance_requirement",
          title: "Missing acceptance requirement",
          summary: "The implementation omits an acceptance requirement.",
        },
        {
          failureMode: "spec_behavior_contradiction",
          title: "Spec behavior contradiction",
          summary: "The implementation contradicts the requested behavior.",
        },
      ],
    });
    const fm = setupFlowManager(baseFlowState({
      metrics: [
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "reviewRetry", delta: 1, taskId: null },
      ],
    }));
    const { checkReviewRetryBelowMax } = await import("../../../src/flow/lib/run-review.js");
    const result = checkReviewRetryBelowMax({ root: tmp, flowManager: fm, flowState: fm.load(), phase: "spec" }, "spec");
    assert.equal(result.result, "deferred");
    assert.equal(result.artifacts.findingCount, 2);
    const source = JSON.parse(fs.readFileSync(path.join(specDir, "spec-review.json"), "utf8"));
    assert.equal(source.blockingFindings[0].findingId, "review-finding-1");
    assert.equal(source.blockingFindings[1].findingId, "review-finding-2");
    const findings = JSON.parse(fs.readFileSync(path.join(specDir, "flow-findings.json"), "utf8"));
    assert.deepEqual(
      findings.entries.map((entry) => entry.sourceFindingId),
      ["review-finding-1", "review-finding-2"],
    );
  });

  it("R3: gate retry exhaustion writes a durable source artifact reference and preserves mechanical blockers", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeGateSourceArtifact(specDir);
    const fm = setupFlowManager(baseFlowState({
      steps: buildInitialSteps().map((step) => {
        if (step.id !== "plan") return step;
        return {
          ...step,
          children: step.children.map((child) => (
            child.id === "spec-gate" ? { ...child, status: "in_progress" } : child
          )),
        };
      }),
      metrics: [
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
      ],
    }));
    const { checkRetryBelowMax } = await import("../../../src/flow/lib/run-gate.js");
    const result = checkRetryBelowMax({ root: tmp, flowManager: fm, flowState: fm.load() }, "spec");
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "ESCALATE_RETRY_EXHAUSTED");
    assert.equal(fs.existsSync(path.join(specDir, "flow-findings.json")), false);
    assert.equal(findStepById(fm.load().steps, "spec-gate").status, "in_progress");
  });

  it("R3: requirement gate failures defer and stale source artifacts do not mask current blockers", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeJsonFile(path.join(specDir, "spec-gate-source.json"), {
      phase: "spec",
      result: "fail",
      evaluations: [
        {
          result: "fail",
          category: "requirements",
          guardrail_id: "R1",
          reason: "The implementation is missing the required behavior.",
        },
      ],
    });
    let fm = setupFlowManager(baseFlowState({
      steps: buildInitialSteps().map((step) => {
        if (step.id !== "plan") return step;
        return {
          ...step,
          children: step.children.map((child) => (
            child.id === "spec-gate" ? { ...child, status: "in_progress" } : child
          )),
        };
      }),
      metrics: [
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
      ],
    }));
    const { checkRetryBelowMax } = await import("../../../src/flow/lib/run-gate.js");
    const result = checkRetryBelowMax({ root: tmp, flowManager: fm, flowState: fm.load() }, "spec");
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "ESCALATE_RETRY_EXHAUSTED");

    fs.rmSync(path.join(specDir, "flow-findings.json"), { force: true });
    writeJsonFile(path.join(specDir, "spec-gate-result.json"), {
      phase: "spec",
      result: "fail",
      sourceArtifactStatus: "invalid_schema",
      evaluations: [],
    });
    const staleBlocked = checkRetryBelowMax({ root: tmp, flowManager: fm, flowState: fm.load() }, "spec");
    assert.equal(staleBlocked.ok, false);
    assert.equal(staleBlocked.errors[0].code, "ESCALATE_RETRY_EXHAUSTED");
    assert.equal(fs.existsSync(path.join(specDir, "flow-findings.json")), false);
    assert.equal(findStepById(fm.load().steps, "spec-gate").status, "in_progress");
  });

  it("R3: mechanical gate retry exhaustion cases remain blocking", async () => {
    const runGate = await import("../../../src/flow/lib/run-gate.js");
    assert.equal(typeof runGate.classifyGateRetryExhaustionSource, "function");
    const cases = [
      ["invalid_schema", { sourceArtifactStatus: "invalid_schema" }],
      ["failed_command", { command: { exitCode: 1 } }],
      ["failed_test_evidence", { testEvidence: { result: "fail" } }],
      ["tooling_failure", { toolingFailure: "parser_error" }],
      ["no_progress_guard", { guardCode: "NO_PROGRESS_SINCE_LAST_FAIL" }],
      ["flow_corruption", { flowStateValid: false }],
    ];
    for (const [name, input] of cases) {
      const classification = runGate.classifyGateRetryExhaustionSource(input);
      assert.equal(classification.completionKind, "blocking", name);
      assert.equal(classification.deferAllowed, false, name);
    }
  });

  it("R3: current structural gate blockers are evaluated before retry deferral", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    initializeGitRepo(tmp);
    writeGateSourceArtifact(specDir);
    fs.writeFileSync(path.join(specDir, "spec.json"), "{\n");
    const fm = setupFlowManager(baseFlowState({
      steps: buildInitialSteps().map((step) => {
        if (step.id !== "plan") return step;
        return {
          ...step,
          children: step.children.map((child) => (
            child.id === "spec-gate" ? { ...child, status: "in_progress" } : child
          )),
        };
      }),
      metrics: [
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
        { phase: "spec", counter: "gateRetry", delta: 1, taskId: null },
      ],
    }));
    const { default: RunGateCommand } = await import("../../../src/flow/lib/run-gate.js");
    const result = await new RunGateCommand().execute({
      root: tmp,
      flowManager: fm,
      flowState: fm.load(),
      config: {},
      phase: "spec",
      skipGuardrail: true,
    });
    assert.equal(result.result, "fail");
    assert.match(result.artifacts.issues[0], /invalid JSON/);
    assert.equal(fs.existsSync(path.join(specDir, "flow-findings.json")), false);
    assert.equal(findStepById(fm.load().steps, "spec-gate").status, "in_progress");
  });

  it("R5: acceptance-review reads carried findings and persists final dispositions", async () => {
    const dispositions = ["fixed", "not_needed", "false_positive", "pre_existing", "still_open", "blocking"];
    const fixture = createAcceptanceReviewFixture({
      deferredFindings: dispositions.map((disposition, index) => ({
          findingId: `DF-${index + 1}`,
          sourceStep: index % 2 === 0 ? "spec-review" : "impl-gate",
          sourceArtifact: index % 2 === 0 ? "spec-review.json" : "impl-gate-result.json",
          sourceFindingId: `F-${index + 1}`,
      })),
    });
    try {
      const { artifact, written } = runAcceptanceReviewFixture({
        root: fixture.root,
        state: fixture.state,
        diff: fixture.diff,
        requirementJudgments: fixture.requirementJudgments,
        deferredFindingDispositions: fixture.dispositionJudgments(dispositions),
        persist: true,
      });
      assert.equal(artifact.deferredFindings.length, 6);
      assert.equal(artifact.deferredFindings[0].findingId, "DF-1");
      assert.equal(artifact.deferredFindings[0].finalDisposition, "fixed");
      assert.equal(artifact.deferredFindings[5].finalDisposition, "blocking");
      assert.deepEqual(
        artifact.deferredFindings.map((finding) => [
          finding.sourceArtifact,
          finding.sourceFindingId,
          finding.evidenceRefs,
        ]),
        dispositions.map((_, index) => {
          const sourceArtifact = index % 2 === 0 ? "spec-review.json" : "impl-gate-result.json";
          const sourceFindingId = `F-${index + 1}`;
          return [sourceArtifact, sourceFindingId, [`${sourceArtifact}#${sourceFindingId}`]];
        }),
      );
      assert.equal(artifact.verdict, "user_decision_required");
      const persisted = JSON.parse(fs.readFileSync(written.path, "utf8"));
      assert.deepEqual(
        persisted.deferredFindings.map((finding) => [finding.findingId, finding.finalDisposition]),
        dispositions.map((disposition, index) => [`DF-${index + 1}`, disposition]),
      );
      assert.deepEqual(
        persisted.deferredFindings.map((finding) => finding.evidenceRefs),
        artifact.deferredFindings.map((finding) => finding.evidenceRefs),
      );

      const { writeAcceptanceReviewArtifact } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
      for (const invalidDisposition of ["unsupported", null]) {
        const invalid = structuredClone(artifact);
        invalid.deferredFindings[0].finalDisposition = invalidDisposition;
        assert.throws(() => writeAcceptanceReviewArtifact({
          specDir: fixture.specDir,
          artifact: invalid,
          requirementIds: fixture.requirementIds,
          fingerprint: fixture.fingerprint,
          flowState: fixture.state,
        }), /finalDisposition/);
      }
    } finally {
      fixture.cleanup();
    }
  });

  it("R5: pass acceptance verdict cannot hide unresolved deferred findings", async () => {
    const fixture = createAcceptanceReviewFixture({ includeDeferredFinding: true });
    try {
      const { artifact, written } = runAcceptanceReviewFixture({
        root: fixture.root,
        state: fixture.state,
        diff: fixture.diff,
        requirementJudgments: fixture.requirementJudgments,
        deferredFindingDispositions: fixture.dispositionJudgments("still_open"),
        persist: true,
      });
      assert.equal(artifact.verdict, "user_decision_required");
      assert.equal(written.artifact.hardBlockers[0].kind, "unresolved_deferred_finding");
      const { validateAcceptanceReviewArtifact } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
      assert.throws(() => validateAcceptanceReviewArtifact({
        ...artifact,
        verdict: "pass",
      }, { requirementIds: fixture.requirementIds }), /derived verdict/);
    } finally {
      fixture.cleanup();
    }
  });

  it("R5: acceptance-review must classify every carried flow finding exactly once", async () => {
    const fixture = createAcceptanceReviewFixture({ deferredFindings: [
      { findingId: "DF-1", sourceStep: "impl-gate", sourceArtifact: "impl-gate-result.json", sourceFindingId: "F-1" },
      { findingId: "DF-2", sourceStep: "impl-review", sourceArtifact: "impl-review.json", sourceFindingId: "F-2" },
    ] });
    try {
      const { artifact } = runAcceptanceReviewFixture({
        root: fixture.root,
        state: fixture.state,
        diff: fixture.diff,
        requirementJudgments: fixture.requirementJudgments,
        deferredFindingDispositions: fixture.dispositionJudgments("fixed"),
      });
      const { writeAcceptanceReviewArtifact } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
      assert.throws(() => writeAcceptanceReviewArtifact({
        specDir: fixture.specDir,
        artifact: {
          ...artifact,
          deferredFindings: [...artifact.deferredFindings, {
            findingId: "DF-X",
            sourceStep: "impl-review",
            sourceArtifact: "impl-review.json",
            sourceFindingId: "F-X",
            finalDisposition: "fixed",
            evidenceRefs: [],
          }],
        },
        requirementIds: fixture.requirementIds,
        fingerprint: fixture.fingerprint,
        flowState: fixture.state,
      }), /unknown deferred finding classification: DF-X/);
    } finally {
      fixture.cleanup();
    }
  });

  it("R5: flow-findings mirrored finalDisposition is not acceptance decision input", async () => {
    const fixture = createAcceptanceReviewFixture({
      deferredFindings: [{
        findingId: "DF-1",
        sourceStep: "impl-gate",
        sourceArtifact: "impl-gate-result.json",
        sourceFindingId: "F-1",
      }],
    });
    try {
      const findingsPath = path.join(fixture.specDir, "flow-findings.json");
      const mirrored = JSON.parse(fs.readFileSync(findingsPath, "utf8"));
      mirrored.entries[0].finalDisposition = "fixed";
      writeJsonFile(findingsPath, mirrored);

      const { artifact } = runAcceptanceReviewFixture({
        root: fixture.root,
        state: fixture.state,
        diff: fixture.diff,
        requirementJudgments: fixture.requirementJudgments,
        deferredFindingDispositions: fixture.dispositionJudgments("still_open"),
      });
      assert.equal(artifact.deferredFindings[0].finalDisposition, "still_open");
      assert.equal(artifact.verdict, "user_decision_required");
    } finally {
      fixture.cleanup();
    }
  });

  it("R5: acceptance-review command path consumes deferred findings input history", async () => {
    const fixture = createAcceptanceReviewFixture({ includeDeferredFinding: true });
    const responsePath = path.join(os.tmpdir(), `senti-293-acceptance-response-${process.pid}-${Date.now()}.json`);
    const priorFixture = process.env.SENTI_ACCEPTANCE_REVIEW_ARTIFACT;
    try {
      fs.writeFileSync(responsePath, JSON.stringify({
        requirementJudgments: fixture.requirementJudgments,
        deferredFindingDispositions: fixture.dispositionJudgments("still_open"),
      }, null, 2) + "\n");
      process.env.SENTI_ACCEPTANCE_REVIEW_ARTIFACT = responsePath;
      const { default: RunAcceptanceReviewCommand } = await import("../../../src/flow/lib/run-acceptance-review.js");
      const result = await new RunAcceptanceReviewCommand().execute({
        root: fixture.root,
        flowManager: fixture.flowManager,
        flowState: fixture.state,
      });
      assert.equal(result.deferredFindings.length, 1);
      assert.equal(result.deferredFindings[0].findingId, "DF-1");
      assert.equal(result.deferredFindings[0].finalDisposition, "still_open");
      assert.equal(result.verdict, "user_decision_required");
      const persisted = JSON.parse(fs.readFileSync(path.join(fixture.specDir, "acceptance-review.json"), "utf8"));
      assert.equal(persisted.deferredFindings[0].findingId, "DF-1");
      assert.equal(persisted.deferredFindings[0].finalDisposition, "still_open");
      assert.equal(findStepById(fixture.flowManager.load().steps, "acceptance-decision").status, "in_progress");
    } finally {
      if (priorFixture === undefined) delete process.env.SENTI_ACCEPTANCE_REVIEW_ARTIFACT;
      else process.env.SENTI_ACCEPTANCE_REVIEW_ARTIFACT = priorFixture;
      fs.rmSync(responsePath, { force: true });
      fixture.cleanup();
    }
  });

  it("R6: non-pass acceptance-review requires allowlisted nextAction and targetStep", async () => {
    const fixture = createAcceptanceReviewFixture();
    try {
      const judgments = fixture.requirementJudgments.map((judgment) => ({
        ...judgment,
        status: "notMet",
      }));
      const { artifact, written } = runAcceptanceReviewFixture({
        root: fixture.root,
        state: fixture.state,
        diff: fixture.diff,
        requirementJudgments: judgments,
        persist: true,
      });
      assert.equal(artifact.verdict, "repair_required");
      assert.equal(written.artifact.verdict, "repair_required");
      const { validateAcceptanceReviewArtifact } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
      assert.throws(() => validateAcceptanceReviewArtifact({
        ...artifact,
        verdict: "pass",
      }, { requirementIds: fixture.requirementIds }), /derived verdict/);
    } finally {
      fixture.cleanup();
    }
  });

  it("R7: first non-pass acceptance round automatically routes to the target step", async () => {
    const fixture = createAcceptanceReviewFixture();
    try {
      const { applyAcceptanceReviewResult } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
      const { artifact } = runAcceptanceReviewFixture({
        root: fixture.root,
        state: fixture.state,
        diff: fixture.diff,
        requirementJudgments: fixture.requirementJudgments.map((judgment) => ({ ...judgment, status: "notMet" })),
      });
      const result = applyAcceptanceReviewResult({
        root: fixture.root,
        flowManager: fixture.flowManager,
        artifact,
      });
      assert.equal(result.verdict, "repair_required");
      assert.equal(findStepById(fixture.flowManager.load().steps, "impl-triage").status, "in_progress");
    } finally {
      fixture.cleanup();
    }
  });

  it("R7: second non-pass acceptance round stops automatic routing and blocks risk acceptance with mechanical blockers", async () => {
    const fixture = createAcceptanceReviewFixture();
    try {
      const { applyAcceptanceReviewResult, applyAcceptanceDecision } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
      const { artifact } = runAcceptanceReviewFixture({
        root: fixture.root,
        state: fixture.state,
        diff: fixture.diff,
        requirementJudgments: fixture.requirementJudgments,
      });
      const result = applyAcceptanceReviewResult({
        root: fixture.root,
        flowManager: fixture.flowManager,
        artifact: {
          ...artifact,
          mechanicalBlockers: [{ blockerId: "M-1", kind: "failed_tests", summary: "Test evidence contains failures." }],
          verdict: "blocked",
        },
      });
      assert.equal(result.verdict, "blocked");
      assert.equal(findStepById(fixture.flowManager.load().steps, "acceptance-review").status, "in_progress");
      assert.throws(() => applyAcceptanceDecision({
        root: fixture.root,
        flowManager: fixture.flowManager,
        choice: "accept_risk_and_continue",
      }), /not available/);
    } finally {
      fixture.cleanup();
    }
  });

  it("R7: second amend-required acceptance round exposes a user decision path", async () => {
    const fixture = createAcceptanceReviewFixture({ includeDeferredFinding: true });
    try {
      const { applyAcceptanceReviewResult, applyAcceptanceDecision } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
      const { artifact } = runAcceptanceReviewFixture({
        root: fixture.root,
        state: fixture.state,
        diff: fixture.diff,
        requirementJudgments: fixture.requirementJudgments,
        deferredFindingDispositions: fixture.dispositionJudgments("still_open"),
      });
      const result = applyAcceptanceReviewResult({
        root: fixture.root,
        flowManager: fixture.flowManager,
        artifact,
      });
      assert.equal(result.verdict, "user_decision_required");
      assert.equal(findStepById(fixture.flowManager.load().steps, "acceptance-decision").status, "in_progress");
      const decision = applyAcceptanceDecision({
        root: fixture.root,
        flowManager: fixture.flowManager,
        choice: "accept_risk_and_continue",
      });
      assert.equal(decision.choice, "accept_risk_and_continue");
      assert.equal(findStepById(fixture.flowManager.load().steps, "final-regression").status, "in_progress");
    } finally {
      fixture.cleanup();
    }
  });

  it("R8: retry metrics, review artifacts, and issue-log evidence remain intact after deferral", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeReviewArtifact(specDir);
    writeJsonFile(path.join(specDir, "issue-log.json"), {
      entries: [{ step: "spec-review", reason: "existing review issue-log entry" }],
    });
    const fm = setupFlowManager(baseFlowState({
      metrics: [{ phase: "spec", counter: "reviewRetry", delta: 1, taskId: null }],
    }));
    const { appendDeferredFlowFinding } = await importFlowFindingsModule();
    appendDeferredFlowFinding({
      root: tmp,
      flowState: fm.load(),
      sourceStep: "spec-review",
      sourceArtifact: "spec-review.json",
      sourceFindingId: "F-review-1",
      fingerprint: "f".repeat(64),
      rationale: "The retry policy deferred this semantic review finding.",
      attempts: 1,
      round: 1,
    });
    assert.ok(fs.existsSync(path.join(specDir, "spec-review.json")));
    assert.equal(JSON.parse(fs.readFileSync(path.join(specDir, "issue-log.json"), "utf8")).entries.length, 1);
    assert.equal(fm.load().metrics.length, 1);
  });

  it("R8: deferred findings do not weaken no-progress and tooling-failure guards", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeJsonFile(path.join(specDir, "flow-findings.json"), { version: 1, entries: [] });
    const {
      checkNoProgressSinceLastFail,
    } = await import("../../../src/flow/lib/run-gate.js");
    const flowState = baseFlowState({
      metrics: [{ phase: "integration", counter: "gateRetry", delta: 1 }],
      gateImplMemory: {
        phase: "integration",
        headSha: "abc",
        worktreeHash: "same",
      },
    });
    const noProgress = checkNoProgressSinceLastFail({
      flowState,
      issueLog: { entries: [] },
      phase: "integration",
      currentState: { headSha: "abc", worktreeHash: "same" },
      ctx: { root: tmp, flowState },
    });
    assert.equal(noProgress.ok, false);
    assert.equal(noProgress.errors[0].code, "NO_PROGRESS_SINCE_LAST_FAIL");

    const { updateReviewRetryCounter } = await import("../../../src/flow/lib/run-review.js");
    const fm = setupFlowManager(baseFlowState());
    updateReviewRetryCounter({
      flowState: fm.load(),
      flowManager: fm,
      phase: "test",
    }, {
      artifacts: { retryPhase: "test", verdict: "TOOLING_FAILURE" },
    });
    assert.equal(fm.load().metrics.at(-1).counter, "reviewRetry");
  });

  it("R8: deferred findings preserve acceptance pass and mechanical reset behavior", async () => {
    const fixture = createAcceptanceReviewFixture();
    try {
      const { applyAcceptanceReviewResult } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
      const { artifact } = runAcceptanceReviewFixture({
        root: fixture.root,
        state: fixture.state,
        diff: fixture.diff,
        requirementJudgments: fixture.requirementJudgments,
      });
      applyAcceptanceReviewResult({ root: fixture.root, flowManager: fixture.flowManager, artifact });
      assert.equal(findStepById(fixture.flowManager.load().steps, "acceptance-review").status, "done");
      assert.equal(findStepById(fixture.flowManager.load().steps, "final-regression").status, "in_progress");
      applyAcceptanceReviewResult({
        root: fixture.root,
        flowManager: fixture.flowManager,
        artifact: {
          ...artifact,
          mechanicalBlockers: [{ blockerId: "M-1", kind: "missing_artifact", summary: "Required artifact is missing." }],
          verdict: "blocked",
        },
      });
      assert.equal(findStepById(fixture.flowManager.load().steps, "acceptance-review").status, "in_progress");
    } finally {
      fixture.cleanup();
    }
  });

  it("R9: status summary exposes bounded deferred finding counts without becoming routing source", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeJsonFile(path.join(specDir, "flow-findings.json"), {
      version: 1,
      entries: [
        {
          findingId: "DF-1",
          sourceStep: "impl-gate",
          sourceArtifact: "impl-gate-result.json",
          sourceFindingId: "F-gate-1",
          retryExhausted: true,
          attempts: 2,
          round: 1,
          completionKind: "deferred",
          finalDisposition: null,
        },
        {
          findingId: "DF-2",
          sourceStep: "spec-review",
          sourceArtifact: "spec-review.json",
          sourceFindingId: "F-review-1",
          retryExhausted: true,
          attempts: 2,
          round: 1,
          completionKind: "deferred",
          finalDisposition: null,
        },
      ],
    });
    const { buildDeferredFindingsSummary } = await importFlowFindingsModule();
    const summary = buildDeferredFindingsSummary({ specDir });
    assert.deepEqual(summary, {
      count: 2,
      sourceSteps: ["impl-gate", "spec-review"],
      artifactPath: "flow-findings.json",
    });
    assert.equal(Object.hasOwn(summary, "nextAction"), false);
    assert.equal(Object.hasOwn(summary, "targetStep"), false);
  });
});
