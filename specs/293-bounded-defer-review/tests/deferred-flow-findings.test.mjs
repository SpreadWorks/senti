// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { makeFlowManager, setupFlow } from "../../../tests/helpers/flow-setup.js";
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
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

async function importFlowFindingsModule() {
  const moduleUrl = new URL("../../../src/flow/lib/flow-findings.js", import.meta.url);
  assert.ok(fs.existsSync(fileURLToPath(moduleUrl)), "src/flow/lib/flow-findings.js should exist");
  return import(moduleUrl.href);
}

function baseFlowState(overrides = {}) {
  return {
    spec: "specs/001-test/spec.json",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps: buildInitialSteps(),
    requirements: [{ id: "R1", desc: "test", priority: "must", status: "pending" }],
    tasks: [],
    currentTaskId: null,
    metrics: [],
    ...overrides,
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
    writeJsonFile(path.join(specDir, "impl-gate-result.json"), {
      phase: "integration",
      result: "fail",
      verdict: "fail",
      nextAction: null,
      evaluations: [{ findingId: "F-gate-1", result: "fail", failureMode: "content_alignment" }],
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
    assert.deepEqual([...statusValues].sort(), ["done", "in_progress", "pending"]);
    assert.equal(statusValues.has("deferred"), false);
  });

  it("R1: deferred completion evidence requires exact spec-relative artifact path", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeJsonFile(path.join(specDir, "impl-gate-result.json"), {
      phase: "integration",
      result: "fail",
      verdict: "fail",
      evaluations: [{ findingId: "F-real", result: "fail", failureMode: "content_alignment" }],
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
    assert.equal(result.result, "deferred");
    assert.equal(result.artifacts.deferred, true);
    const findings = JSON.parse(fs.readFileSync(path.join(specDir, "flow-findings.json"), "utf8"));
    assert.equal(findings.entries[0].sourceStep, "spec-gate");
    assert.equal(findings.entries[0].sourceArtifact, "spec-gate-source.json");
    assert.ok(fs.existsSync(path.join(specDir, findings.entries[0].sourceArtifact)));
    assert.equal(findStepById(fm.load().steps, "spec-gate").status, "done");

    fs.rmSync(path.join(specDir, "flow-findings.json"));
    fs.rmSync(path.join(specDir, "spec-gate-source.json"));
    writeJsonFile(path.join(specDir, "spec-gate-result.json"), {
      phase: "spec",
      result: "fail",
      evaluations: [
        {
          findingId: "F-gate-2",
          guardrail_id: "spec-content-alignment",
          result: "fail",
          failureMode: "content_alignment",
          reason: "The detector reported a second alignment concern.",
        },
      ],
    });
    const createdSource = checkRetryBelowMax({ root: tmp, flowManager: fm, flowState: fm.load() }, "spec");
    assert.equal(createdSource.result, "deferred");
    assert.equal(createdSource.artifacts.deferred, true);
    const generated = JSON.parse(fs.readFileSync(path.join(specDir, "flow-findings.json"), "utf8"));
    assert.ok(fs.existsSync(path.join(specDir, generated.entries[0].sourceArtifact)));

    fs.rmSync(path.join(specDir, "flow-findings.json"));
    fs.rmSync(path.join(specDir, generated.entries[0].sourceArtifact));
    fs.rmSync(path.join(specDir, "spec-gate-result.json"));
    writeJsonFile(path.join(specDir, "spec-gate-source.json"), {
      phase: "spec",
      result: "fail",
      evaluations: [
        {
          result: "fail",
          guardrail_id: "shared-content-guardrail",
          failureMode: "content_alignment",
          reason: "The detector reported an alignment concern without a durable id.",
        },
      ],
    });
    const idless = checkRetryBelowMax({ root: tmp, flowManager: fm, flowState: fm.load() }, "spec");
    assert.equal(idless.result, "deferred");
    const idlessSource = JSON.parse(fs.readFileSync(path.join(specDir, "spec-gate-source.json"), "utf8"));
    assert.equal(idlessSource.evaluations[0].findingId, "gate-finding-1");
    const idlessFindings = JSON.parse(fs.readFileSync(path.join(specDir, "flow-findings.json"), "utf8"));
    assert.equal(idlessFindings.entries[0].sourceFindingId, "gate-finding-1");

    fs.rmSync(path.join(specDir, "flow-findings.json"));
    fs.rmSync(path.join(specDir, "spec-gate-source.json"));
    const blocker = checkRetryBelowMax({ root: tmp, flowManager: fm, flowState: fm.load() }, "spec");
    assert.equal(blocker.ok, false);
    assert.equal(blocker.errors[0].code, "ESCALATE_RETRY_EXHAUSTED");
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
    assert.equal(result.result, "deferred");
    const source = JSON.parse(fs.readFileSync(path.join(specDir, "spec-gate-source.json"), "utf8"));
    assert.equal(source.evaluations[0].findingId, "gate-finding-1");

    fs.rmSync(path.join(specDir, "flow-findings.json"));
    writeJsonFile(path.join(specDir, "spec-gate-result.json"), {
      phase: "spec",
      result: "fail",
      sourceArtifactStatus: "invalid_schema",
      evaluations: [],
    });
    fm = setupFlowManager(baseFlowState({
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
    assert.match(result.artifacts.issues[0], /schema:/);
    assert.equal(fs.existsSync(path.join(specDir, "flow-findings.json")), false);
    assert.equal(findStepById(fm.load().steps, "spec-gate").status, "in_progress");
  });

  it("R5: acceptance-review reads carried findings and persists final dispositions", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeJsonFile(path.join(specDir, "flow-findings.json"), {
      version: 1,
      entries: [
        ...["fixed", "not_needed", "false_positive", "pre_existing", "still_open", "blocking"].map((disposition, index) => ({
          findingId: `DF-${index + 1}`,
          sourceStep: index % 2 === 0 ? "spec-review" : "impl-gate",
          sourceArtifact: index % 2 === 0 ? "spec-review.json" : "impl-gate-result.json",
          sourceFindingId: `F-${index + 1}`,
          retryExhausted: true,
          attempts: 2,
          round: 1,
          completionKind: "deferred",
          finalDisposition: null,
        })),
      ],
    });
    writeJsonFile(path.join(specDir, "acceptance-review-evidence.json"), {
      version: 1,
      deferredFindingDispositions: ["fixed", "not_needed", "false_positive", "pre_existing", "still_open", "blocking"].map((disposition, index) => ({
        findingId: `DF-${index + 1}`,
        finalDisposition: disposition,
        evidenceRefs: [`acceptance-review-evidence.json#${disposition}`],
      })),
    });
    const {
      buildAcceptanceReviewArtifactFromEvidence,
      writeAcceptanceReviewArtifact,
    } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
    const artifact = buildAcceptanceReviewArtifactFromEvidence({ specDir });
    assert.equal(artifact.deferredFindings.length, 6);
    assert.equal(artifact.deferredFindings[0].findingId, "DF-1");
    assert.equal(artifact.deferredFindings[0].finalDisposition, "fixed");
    assert.equal(artifact.deferredFindings[5].finalDisposition, "blocking");
    const written = writeAcceptanceReviewArtifact({ specDir, artifact });
    const persisted = JSON.parse(fs.readFileSync(written.path, "utf8"));
    assert.equal(persisted.deferredFindings.length, 6);
    assert.deepEqual(
      persisted.deferredFindings.map((finding) => [finding.findingId, finding.finalDisposition]),
      [
        ["DF-1", "fixed"],
        ["DF-2", "not_needed"],
        ["DF-3", "false_positive"],
        ["DF-4", "pre_existing"],
        ["DF-5", "still_open"],
        ["DF-6", "blocking"],
      ],
    );
    artifact.deferredFindings[0].finalDisposition = "unsupported";
    assert.throws(() => writeAcceptanceReviewArtifact({ specDir, artifact }), /finalDisposition/);
    artifact.deferredFindings[0].finalDisposition = null;
    assert.throws(() => writeAcceptanceReviewArtifact({ specDir, artifact }), /finalDisposition/);
  });

  it("R5: pass acceptance verdict cannot hide unresolved deferred findings", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeJsonFile(path.join(specDir, "flow-findings.json"), {
      version: 1,
      entries: [
        {
          findingId: "DF-1",
          sourceStep: "impl-gate",
          sourceArtifact: "impl-gate-result.json",
          sourceFindingId: "F-1",
          retryExhausted: true,
          attempts: 2,
          round: 1,
          completionKind: "deferred",
          finalDisposition: null,
        },
      ],
    });
    const {
      writeAcceptanceReviewArtifact,
      validateAcceptanceReviewArtifact,
    } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
    const artifact = {
      goalSatisfactionScore: 1,
      requirementAlignmentScore: 1,
      implementationQualityScore: 1,
      acceptanceScore: 1,
      thresholds: { goalSatisfactionPass: 0.9, requirementAlignmentPass: 0.9, implementationQualityPass: 0.8 },
      mechanicalBlockers: [],
      hardBlockers: [],
      attempt: 1,
      findings: [],
      deferredFindings: [
        {
          findingId: "DF-1",
          sourceStep: "impl-gate",
          sourceArtifact: "impl-gate-result.json",
          sourceFindingId: "F-1",
          finalDisposition: "still_open",
          evidenceRefs: [],
        },
      ],
      requirementAmendmentProposals: [],
      userDecision: null,
      blockedDecision: null,
      verdict: "pass",
      nextAction: "repair",
      targetStep: "implement",
    };
    const written = writeAcceptanceReviewArtifact({ specDir, artifact });
    assert.equal(written.artifact.verdict, "amend_required");
    assert.throws(() => validateAcceptanceReviewArtifact({
      ...written.artifact,
      verdict: "pass",
    }), /verdict/);
  });

  it("R5: acceptance-review must classify every carried flow finding exactly once", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeJsonFile(path.join(specDir, "flow-findings.json"), {
      version: 1,
      entries: [
        {
          findingId: "DF-1",
          sourceStep: "impl-gate",
          sourceArtifact: "impl-gate-result.json",
          sourceFindingId: "F-1",
          retryExhausted: true,
          attempts: 2,
          round: 1,
          completionKind: "deferred",
          finalDisposition: null,
        },
        {
          findingId: "DF-2",
          sourceStep: "impl-review",
          sourceArtifact: "impl-review.json",
          sourceFindingId: "F-2",
          retryExhausted: true,
          attempts: 2,
          round: 1,
          completionKind: "deferred",
          finalDisposition: null,
        },
      ],
    });
    const { writeAcceptanceReviewArtifact } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
    const baseArtifact = {
      goalSatisfactionScore: 1,
      requirementAlignmentScore: 1,
      implementationQualityScore: 1,
      acceptanceScore: 1,
      thresholds: { goalSatisfactionPass: 0.9, requirementAlignmentPass: 0.9, implementationQualityPass: 0.8 },
      mechanicalBlockers: [],
      hardBlockers: [],
      attempt: 1,
      findings: [],
      deferredFindings: [
        {
          findingId: "DF-1",
          sourceStep: "impl-gate",
          sourceArtifact: "impl-gate-result.json",
          sourceFindingId: "F-1",
          finalDisposition: "fixed",
          evidenceRefs: ["acceptance-review-evidence.json#DF-1"],
        },
      ],
      requirementAmendmentProposals: [],
      userDecision: null,
      blockedDecision: null,
      verdict: "pass",
    };
    assert.throws(() => writeAcceptanceReviewArtifact({ specDir, artifact: baseArtifact }), /missing deferred finding classification: DF-2/);
    assert.throws(() => writeAcceptanceReviewArtifact({
      specDir,
      artifact: {
        ...baseArtifact,
        deferredFindings: [
          ...baseArtifact.deferredFindings,
          {
            findingId: "DF-X",
            sourceStep: "impl-review",
            sourceArtifact: "impl-review.json",
            sourceFindingId: "F-X",
            finalDisposition: "fixed",
            evidenceRefs: [],
          },
        ],
      },
    }), /unknown deferred finding classification: DF-X/);
  });

  it("R5: flow-findings mirrored finalDisposition is not acceptance decision input", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeJsonFile(path.join(specDir, "scenario-validity-result.json"), {
      version: "1",
      result: "pass",
      summary: [{ id: "R1", classification: "expected_fail" }],
    });
    writeJsonFile(path.join(specDir, "test-execute-result.json"), {
      version: "2",
      result: "pass",
      summary: [{ id: "R1", result: "pass" }],
    });
    writeJsonFile(path.join(specDir, "test-result-review.json"), {
      version: "1",
      verdict: "pass",
      checked_items: [{ id: "R1", result: "pass" }],
    });
    writeJsonFile(path.join(specDir, "retro.json"), {
      version: 1,
      status: "done",
      summary: { notes: [] },
    });
    fs.mkdirSync(path.join(specDir, "tests"), { recursive: true });
    fs.writeFileSync(path.join(specDir, "tests", "acceptance.test.mjs"), "export {};\n");
    writeJsonFile(path.join(specDir, "flow-findings.json"), {
      version: 1,
      entries: [
        {
          findingId: "DF-1",
          sourceStep: "impl-gate",
          sourceArtifact: "impl-gate-result.json",
          sourceFindingId: "F-1",
          retryExhausted: true,
          attempts: 2,
          round: 1,
          completionKind: "deferred",
          finalDisposition: "fixed",
        },
      ],
    });
    const { buildAcceptanceReviewArtifactFromEvidence } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
    const artifact = buildAcceptanceReviewArtifactFromEvidence({ specDir });
    assert.equal(artifact.deferredFindings[0].finalDisposition, "still_open");
    assert.equal(artifact.verdict, "amend_required");
  });

  it("R5: acceptance-review command path consumes deferred findings input history", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeJsonFile(path.join(specDir, "scenario-validity-result.json"), {
      version: "1",
      result: "pass",
      summary: [{ id: "R1", classification: "expected_fail" }],
    });
    writeJsonFile(path.join(specDir, "test-execute-result.json"), {
      version: "2",
      result: "pass",
      summary: [{ id: "R1", result: "pass" }],
    });
    writeJsonFile(path.join(specDir, "test-result-review.json"), {
      version: "1",
      verdict: "pass",
      checked_items: [{ id: "R1", result: "pass" }],
    });
    writeJsonFile(path.join(specDir, "retro.json"), {
      version: 1,
      status: "done",
      summary: { notes: [] },
    });
    writeJsonFile(path.join(specDir, "flow-findings.json"), {
      version: 1,
      entries: [
        {
          findingId: "DF-1",
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
    const fm = setupFlowManager(baseFlowState());
    const { default: RunAcceptanceReviewCommand } = await import("../../../src/flow/lib/run-acceptance-review.js");
    const result = new RunAcceptanceReviewCommand().execute({
      root: tmp,
      flowManager: fm,
      flowState: fm.load(),
    });
    assert.equal(result.deferredFindings.length, 1);
    assert.equal(result.deferredFindings[0].findingId, "DF-1");
    const persisted = JSON.parse(fs.readFileSync(path.join(specDir, "acceptance-review.json"), "utf8"));
    assert.equal(persisted.deferredFindings[0].findingId, "DF-1");
    assert.match(persisted.deferredFindings[0].finalDisposition, /^(fixed|not_needed|false_positive|pre_existing|still_open|blocking)$/);
  });

  it("R6: non-pass acceptance-review requires allowlisted nextAction and targetStep", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    const { writeAcceptanceReviewArtifact } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
    const baseArtifact = {
        goalSatisfactionScore: 0.5,
        requirementAlignmentScore: 0.5,
        implementationQualityScore: 1,
        acceptanceScore: 0.5,
        thresholds: { goalSatisfactionPass: 0.9, requirementAlignmentPass: 0.9, implementationQualityPass: 0.8 },
        mechanicalBlockers: [],
        hardBlockers: [],
        attempt: 1,
        findings: [],
        requirementAmendmentProposals: [],
        userDecision: null,
        blockedDecision: null,
        verdict: "amend_required",
    };
    assert.throws(() => writeAcceptanceReviewArtifact({
      specDir,
      artifact: {
        ...baseArtifact,
        nextAction: "amend",
        targetStep: "finalize-cleanup",
      },
    }), /targetStep/);
    assert.throws(() => writeAcceptanceReviewArtifact({
      specDir,
      artifact: {
        ...baseArtifact,
        targetStep: "implement",
      },
    }), /nextAction/);
    assert.throws(() => writeAcceptanceReviewArtifact({
      specDir,
      artifact: {
        ...baseArtifact,
        nextAction: "amend",
      },
    }), /targetStep/);
    assert.throws(() => writeAcceptanceReviewArtifact({
      specDir,
      artifact: {
        ...baseArtifact,
        nextAction: "skip_review",
        targetStep: "implement",
      },
    }), /nextAction/);
    const allowedTargetSteps = ["spec", "test", "implement", "test-execute", "impl-review", "impl-gate"];
    const allowedNextActions = ["amend", "repair", "user_decision"];
    for (const targetStep of allowedTargetSteps) {
      for (const nextAction of allowedNextActions) {
      const written = writeAcceptanceReviewArtifact({
        specDir,
        artifact: {
          ...baseArtifact,
          nextAction,
          targetStep,
        },
      });
      const persisted = JSON.parse(fs.readFileSync(written.path, "utf8"));
      assert.equal(persisted.nextAction, nextAction);
      assert.equal(persisted.targetStep, targetStep);
      }
    }
  });

  it("R7: first non-pass acceptance round automatically routes to the target step", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    const fm = setupFlowManager(baseFlowState({
      acceptanceReview: { round: 0 },
    }));
    const { applyAcceptanceReviewResult } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
    const result = applyAcceptanceReviewResult({
      root: tmp,
      flowManager: fm,
      artifact: {
        goalSatisfactionScore: 0.5,
        requirementAlignmentScore: 0.5,
        implementationQualityScore: 1,
        acceptanceScore: 0.5,
        thresholds: { goalSatisfactionPass: 0.9, requirementAlignmentPass: 0.9, implementationQualityPass: 0.8 },
        mechanicalBlockers: [],
        hardBlockers: [],
        attempt: 1,
        findings: [],
        requirementAmendmentProposals: [],
        userDecision: null,
        blockedDecision: null,
        verdict: "amend_required",
        nextAction: "repair",
        targetStep: "test-execute",
      },
    });
    assert.equal(result.artifact.nextAction, "repair");
    assert.equal(findStepById(fm.load().steps, "test-execute").status, "in_progress");
  });

  it("R7: second non-pass acceptance round stops automatic routing and blocks risk acceptance with mechanical blockers", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    const fm = setupFlowManager(baseFlowState({
      acceptanceReview: { round: 1 },
    }));
    const { applyAcceptanceReviewResult, applyAcceptanceDecision } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
    const result = applyAcceptanceReviewResult({
      root: tmp,
      flowManager: fm,
      artifact: {
        goalSatisfactionScore: 0.5,
        requirementAlignmentScore: 0.5,
        implementationQualityScore: 1,
        acceptanceScore: 0.5,
        thresholds: { goalSatisfactionPass: 0.9, requirementAlignmentPass: 0.9, implementationQualityPass: 0.8 },
        mechanicalBlockers: [{ blockerId: "M-1", kind: "failed_tests", summary: "Test evidence contains failures." }],
        hardBlockers: [],
        attempt: 2,
        findings: [],
        requirementAmendmentProposals: [],
        userDecision: null,
        blockedDecision: null,
        verdict: "blocked",
        nextAction: "repair",
        targetStep: "test-execute",
      },
    });
    assert.equal(result.verdict, "blocked");
    assert.equal(result.artifact.nextAction, "user_decision");
    assert.notEqual(findStepById(fm.load().steps, "test-execute").status, "in_progress");
    assert.throws(() => applyAcceptanceDecision({
      root: tmp,
      flowManager: fm,
      choice: "accept_risk_and_continue",
    }), /mechanicalBlockers/);
  });

  it("R7: second amend-required acceptance round exposes a user decision path", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    const fm = setupFlowManager(baseFlowState({
      acceptanceReview: { round: 1 },
    }));
    const { applyAcceptanceReviewResult, applyAcceptanceDecision } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
    const result = applyAcceptanceReviewResult({
      root: tmp,
      flowManager: fm,
      artifact: {
        goalSatisfactionScore: 0.5,
        requirementAlignmentScore: 0.5,
        implementationQualityScore: 1,
        acceptanceScore: 0.5,
        thresholds: { goalSatisfactionPass: 0.9, requirementAlignmentPass: 0.9, implementationQualityPass: 0.8 },
        mechanicalBlockers: [],
        hardBlockers: [],
        attempt: 2,
        findings: [],
        requirementAmendmentProposals: [],
        userDecision: null,
        blockedDecision: null,
        verdict: "amend_required",
        nextAction: "repair",
        targetStep: "implement",
      },
    });
    assert.equal(result.verdict, "user_decision_required");
    assert.equal(result.artifact.nextAction, "user_decision");
    assert.notEqual(findStepById(fm.load().steps, "implement").status, "in_progress");

    applyAcceptanceDecision({
      root: tmp,
      flowManager: fm,
      choice: "amend_and_retry",
    });
    assert.equal(findStepById(fm.load().steps, "implement").status, "in_progress");
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
    assert.deepEqual(fm.load().metrics || [], []);
  });

  it("R8: deferred findings preserve acceptance pass and mechanical reset behavior", async () => {
    const specDir = makeSpecDir();
    writeBaseSpec(specDir);
    writeJsonFile(path.join(specDir, "flow-findings.json"), { version: 1, entries: [] });
    const fm = setupFlowManager(baseFlowState());
    const { applyAcceptanceReviewResult } = await import("../../../src/flow/lib/acceptance-review-artifacts.js");
    applyAcceptanceReviewResult({
      root: tmp,
      flowManager: fm,
      artifact: {
        goalSatisfactionScore: 1,
        requirementAlignmentScore: 1,
        implementationQualityScore: 1,
        acceptanceScore: 1,
        thresholds: { goalSatisfactionPass: 0.9, requirementAlignmentPass: 0.9, implementationQualityPass: 0.8 },
        mechanicalBlockers: [],
        hardBlockers: [],
        attempt: 1,
        findings: [],
        requirementAmendmentProposals: [],
        userDecision: null,
        blockedDecision: null,
        verdict: "pass",
      },
    });
    assert.equal(findStepById(fm.load().steps, "acceptance-review").status, "done");
    assert.equal(findStepById(fm.load().steps, "final-regression").status, "in_progress");

    applyAcceptanceReviewResult({
      root: tmp,
      flowManager: fm,
      artifact: {
        goalSatisfactionScore: 0,
        requirementAlignmentScore: 0,
        implementationQualityScore: 1,
        acceptanceScore: 0,
        thresholds: { goalSatisfactionPass: 0.9, requirementAlignmentPass: 0.9, implementationQualityPass: 0.8 },
        mechanicalBlockers: [{ blockerId: "M-1", kind: "missing_artifact", summary: "Required artifact is missing." }],
        hardBlockers: [],
        attempt: 1,
        findings: [],
        requirementAmendmentProposals: [],
        userDecision: null,
        blockedDecision: null,
        verdict: "blocked",
        nextAction: "repair",
        targetStep: "test-execute",
      },
    });
    assert.equal(findStepById(fm.load().steps, "test-execute").status, "in_progress");
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
